import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { storageService } from './storage.service';
import { env } from '../../config/env';
import { Errors } from '../../utils/errors';
import { archiveAssetVersionToDrive, archiveProjectToDrive } from './google-drive.archive';
import { assertProjectAccess } from '../projects/projects.service';

export async function storageRoutes(fastify: FastifyInstance) {
  const auth = { onRequest: [fastify.authenticate] };

  // Allow streaming of any content-type for raw file uploads in local mode
  fastify.addContentTypeParser('*', (_req, payload, done) => {
    done(null, payload);
  });

  // POST /api/storage/presign-upload
  fastify.post('/presign-upload', {
    ...auth,
    schema: {
      tags: ['Storage'],
      summary: 'Request a presigned upload URL (for direct client-to-storage upload)',
      body: {
        type: 'object',
        required: ['projectId', 'assetId', 'versionNumber', 'filename', 'mimeType'],
        properties: {
          projectId: { type: 'string' },
          assetId: { type: 'string' },
          versionNumber: { type: 'number' },
          filename: { type: 'string' },
          mimeType: { type: 'string' },
          fileSizeBytes: { type: 'number' },
        },
      },
    },
  }, async (req, reply) => {
    const { projectId, assetId, versionNumber, filename, mimeType, fileSizeBytes } = req.body as any;
    const userId = (req.user as any).sub;

    // Check project membership
    await assertProjectAccess(projectId, userId);

    // Validate mimeType
    if (
      !mimeType.startsWith('image/') &&
      !mimeType.startsWith('video/') &&
      !mimeType.startsWith('audio/')
    ) {
      throw Errors.BadRequest('Unsupported file type. Only image, video, and audio files are supported.');
    }

    // Validate file size
    if (fileSizeBytes !== undefined) {
      const maxBytes = env.STORAGE_MAX_FILE_SIZE_MB * 1024 * 1024;
      if (fileSizeBytes > maxBytes) {
        throw Errors.BadRequest(`File size exceeds the limit of ${env.STORAGE_MAX_FILE_SIZE_MB}MB`);
      }
    }

    const data = await storageService.createPresignedUpload(
      projectId,
      assetId,
      versionNumber,
      filename,
      mimeType
    );
    
    return reply.send(data);
  });

  // POST /api/storage/complete-upload
  fastify.post('/complete-upload', {
    ...auth,
    schema: {
      tags: ['Storage'],
      summary: 'Complete upload validation and return a public or signed URL',
      body: {
        type: 'object',
        required: ['fileKey'],
        properties: {
          fileKey: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { fileKey } = req.body as any;
    const downloadUrl = await storageService.createSignedDownload(fileKey);
    return reply.send({
      success: true,
      fileKey,
      fileUrl: downloadUrl,
    });
  });

  // New query string route for signed URLs (Slash safe)
  // GET /api/storage/signed-url?fileKey=...
  fastify.get('/signed-url', {
    ...auth,
    schema: {
      tags: ['Storage'],
      summary: 'Retrieve temp signed download URL for an asset (slash-safe query string)',
      querystring: {
        type: 'object',
        required: ['fileKey'],
        properties: {
          fileKey: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { fileKey } = req.query as { fileKey: string };
    const downloadUrl = await storageService.createSignedDownload(fileKey);
    return reply.send({ url: downloadUrl });
  });

  // New query string route for deletion (Slash safe)
  // DELETE /api/storage/object?fileKey=...
  fastify.delete('/object', {
    ...auth,
    schema: {
      tags: ['Storage'],
      summary: 'Delete asset file from storage (slash-safe query string)',
      querystring: {
        type: 'object',
        required: ['fileKey'],
        properties: {
          fileKey: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { fileKey } = req.query as { fileKey: string };
    await storageService.deleteObject(fileKey);
    return reply.status(204).send();
  });

  // GET /api/storage/:fileKey/signed-url (Backward compatible, legacy)
  fastify.get('/:fileKey/signed-url', {
    ...auth,
    schema: {
      tags: ['Storage'],
      summary: 'Retrieve temp signed download URL for an asset (Legacy)',
    },
  }, async (req, reply) => {
    const { fileKey } = req.params as { fileKey: string };
    const downloadUrl = await storageService.createSignedDownload(fileKey);
    return reply.send({ url: downloadUrl });
  });

  // DELETE /api/storage/:fileKey (Backward compatible, legacy)
  fastify.delete('/:fileKey', {
    ...auth,
    schema: {
      tags: ['Storage'],
      summary: 'Delete asset file from storage (Legacy)',
    },
  }, async (req, reply) => {
    const { fileKey } = req.params as { fileKey: string };
    await storageService.deleteObject(fileKey);
    return reply.status(204).send();
  });

  // POST /api/storage/archive/version/:versionId
  fastify.post('/archive/version/:versionId', {
    ...auth,
    schema: {
      tags: ['Storage'],
      summary: 'Archive specific AssetVersion to Google Drive folder structure',
    },
  }, async (req, reply) => {
    const { versionId } = req.params as { versionId: string };
    const userId = (req.user as any).sub;
    const res = await archiveAssetVersionToDrive(versionId, userId);
    return reply.send(res);
  });

  // POST /api/storage/archive/project/:projectId
  fastify.post('/archive/project/:projectId', {
    ...auth,
    schema: {
      tags: ['Storage'],
      summary: 'Archive latest version of all assets in a project to Google Drive',
    },
  }, async (req, reply) => {
    const { projectId } = req.params as { projectId: string };
    const userId = (req.user as any).sub;
    const res = await archiveProjectToDrive(projectId, userId);
    return reply.send(res);
  });

  // ─── Local Dev Helpers (only route when driver is local) ───

  // POST /api/storage/local-upload
  fastify.put('/local-upload', async (req, reply) => {
    const query = req.query as { fileKey?: string };
    const fileKey = query.fileKey;
    if (!fileKey) {
      throw Errors.BadRequest('Missing fileKey query parameter');
    }

    const baseDir = path.resolve(env.STORAGE_LOCAL_PATH);
    const safeKey = fileKey.replace(/\//g, path.sep);
    const filePath = path.join(baseDir, safeKey);
    
    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Stream raw body stream straight to file
    const writeStream = fs.createWriteStream(filePath);
    await pipeline(req.raw, writeStream);

    return reply.send({ success: true, fileKey });
  });

  // Support POST as fallback to PUT for local-upload
  fastify.post('/local-upload', async (req, reply) => {
    const query = req.query as { fileKey?: string };
    const fileKey = query.fileKey;
    if (!fileKey) {
      throw Errors.BadRequest('Missing fileKey query parameter');
    }

    const baseDir = path.resolve(env.STORAGE_LOCAL_PATH);
    const safeKey = fileKey.replace(/\//g, path.sep);
    const filePath = path.join(baseDir, safeKey);
    
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const writeStream = fs.createWriteStream(filePath);
    await pipeline(req.raw, writeStream);

    return reply.send({ success: true, fileKey });
  });

  // GET /api/storage/files/* (serves uploaded local files)
  fastify.get('/files/*', async (req, reply) => {
    const fileKey = (req.params as any)['*'];
    const baseDir = path.resolve(env.STORAGE_LOCAL_PATH);
    const safeKey = fileKey.replace(/\//g, path.sep);
    const filePath = path.join(baseDir, safeKey);

    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ error: 'File not found' });
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.wav': 'audio/wav',
      '.mp3': 'audio/mpeg',
    };

    const mimeType = mimeMap[ext] || 'application/octet-stream';
    reply.type(mimeType);

    const stream = fs.createReadStream(filePath);
    return reply.send(stream);
  });
}
