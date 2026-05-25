import { FastifyInstance } from 'fastify';
import {
  getAsset, createAsset, deleteAsset,
  listVersions, createVersion,
  addComment,
  sendToReview, approveVersion, rejectVersion, requestRevision,
  getVersion, getReviews, getComments,
  bulkDeleteAssets, bulkMoveAssets, bulkCopyAssets, bulkDownloadAssets, useAssetsWithAI,
} from './assets.service';

export async function assetRoutes(fastify: FastifyInstance) {
  const auth = { onRequest: [fastify.authenticate] };

  // GET /assets/:id
  fastify.get('/:id', {
    ...auth,
    schema: { tags: ['Assets'], summary: 'Get asset details with comments and versions' },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const asset = await getAsset(id);
    return reply.send({ asset });
  });

  // DELETE /assets/:id
  fastify.delete('/:id', {
    ...auth,
    schema: { tags: ['Assets'], summary: 'Delete an asset (creator only)' },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = (req.user as any).sub;
    await deleteAsset(id, userId);
    return reply.status(204).send();
  });

  // GET /assets/:id/versions
  fastify.get('/:id/versions', {
    ...auth,
    schema: { tags: ['Assets'], summary: 'List all versions of an asset' },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const versions = await listVersions(id);
    return reply.send({ versions });
  });

  // POST /assets/:id/versions
  fastify.post('/:id/versions', {
    ...auth,
    schema: {
      tags: ['Assets'],
      summary: 'Create a new version (generation / edit / upscale output)',
      body: {
        type: 'object',
        properties: {
          fileUrl: { type: 'string' },
          mimeType: { type: 'string' },
          fileSizeBytes: { type: 'number' },
          params: { type: 'object' },
          notes: { type: 'string' },
          jobId: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = (req.user as any).sub;
    const version = await createVersion(id, userId, req.body as any);
    return reply.status(201).send({ version });
  });

  // POST /assets/:id/comments
  fastify.post('/:id/comments', {
    ...auth,
    schema: {
      tags: ['Assets'],
      summary: 'Add a comment to an asset',
      body: {
        type: 'object',
        required: ['body'],
        properties: { body: { type: 'string', minLength: 1 } },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { body } = req.body as { body: string };
    const userId = (req.user as any).sub;
    const comment = await addComment(id, body, userId);
    return reply.status(201).send({ comment });
  });

  // POST /assets/:id/send-to-review
  fastify.post('/:id/send-to-review', {
    ...auth,
    schema: { tags: ['Assets'], summary: 'Send asset to review (sets status to IN_REVIEW)' },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = (req.user as any).sub;
    const asset = await sendToReview(id, userId);
    return reply.send({ asset });
  });

  // POST /assets/upload
  fastify.post('/upload', {
    ...auth,
    schema: {
      tags: ['Assets'],
      summary: 'Upload a completed file to create a new Asset and AssetVersion v1',
      body: {
        type: 'object',
        required: ['projectId', 'fileName', 'fileUrl'],
        properties: {
          projectId: { type: 'string' },
          folderId: { type: 'string' },
          fileName: { type: 'string' },
          mimeType: { type: 'string' },
          fileSizeBytes: { type: 'number' },
          fileKey: { type: 'string' },
          metadata: { type: 'object' },
        },
      },
    },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const body = req.body as any;
    const asset = await createAsset({
      name: body.fileName,
      projectId: body.projectId,
      folderId: body.folderId,
      fileUrl: body.fileUrl,
      mimeType: body.mimeType,
      fileSizeBytes: body.fileSizeBytes,
      metadata: { ...body.metadata, fileKey: body.fileKey },
    }, userId);
    const completeAsset = await getAsset(asset.id);
    return reply.status(201).send({ asset: completeAsset });
  });

  // GET /assets/:id/reviews
  fastify.get('/:id/reviews', {
    ...auth,
    schema: { tags: ['Assets'], summary: 'Get all reviews for an asset' },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const reviews = await getReviews(id);
    return reply.send({ reviews });
  });

  // GET /assets/:id/comments
  fastify.get('/:id/comments', {
    ...auth,
    schema: { tags: ['Assets'], summary: 'Get all comments for an asset' },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const comments = await getComments(id);
    return reply.send({ comments });
  });

  // POST /assets/bulk-delete
  fastify.post('/bulk-delete', {
    ...auth,
    schema: {
      tags: ['Assets'],
      summary: 'Bulk delete assets',
      body: {
        type: 'object',
        required: ['assetIds'],
        properties: {
          assetIds: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { assetIds } = req.body as { assetIds: string[] };
    const result = await bulkDeleteAssets(assetIds, userId);
    return reply.send(result);
  });

  // POST /assets/bulk-move
  fastify.post('/bulk-move', {
    ...auth,
    schema: {
      tags: ['Assets'],
      summary: 'Bulk move assets to another folder',
      body: {
        type: 'object',
        required: ['assetIds', 'targetFolderId'],
        properties: {
          assetIds: { type: 'array', items: { type: 'string' } },
          targetFolderId: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { assetIds, targetFolderId } = req.body as { assetIds: string[], targetFolderId: string };
    const assets = await bulkMoveAssets(assetIds, targetFolderId, userId);
    return reply.send({ assets });
  });

  // POST /assets/bulk-copy
  fastify.post('/bulk-copy', {
    ...auth,
    schema: {
      tags: ['Assets'],
      summary: 'Bulk copy assets to another folder',
      body: {
        type: 'object',
        required: ['assetIds', 'targetFolderId'],
        properties: {
          assetIds: { type: 'array', items: { type: 'string' } },
          targetFolderId: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { assetIds, targetFolderId } = req.body as { assetIds: string[], targetFolderId: string };
    const assets = await bulkCopyAssets(assetIds, targetFolderId, userId);
    return reply.status(201).send({ assets });
  });

  // POST /assets/bulk-download
  fastify.post('/bulk-download', {
    ...auth,
    schema: {
      tags: ['Assets'],
      summary: 'Bulk download assets signed URLs',
      body: {
        type: 'object',
        required: ['assetIds'],
        properties: {
          assetIds: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { assetIds } = req.body as { assetIds: string[] };
    const result = await bulkDownloadAssets(assetIds, userId);
    return reply.send(result);
  });

  // POST /assets/use-with-ai
  fastify.post('/use-with-ai', {
    ...auth,
    schema: {
      tags: ['Assets'],
      summary: 'Trigger AI job or batch on assets',
      body: {
        type: 'object',
        required: ['assetIds', 'projectId', 'toolId', 'jobType', 'mode'],
        properties: {
          assetIds: { type: 'array', items: { type: 'string' } },
          projectId: { type: 'string' },
          toolId: { type: 'string' },
          jobType: { type: 'string' },
          mode: { type: 'string', enum: ['single', 'batch'] }
        }
      }
    }
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const body = req.body as any;
    const result = await useAssetsWithAI(body.assetIds, body, userId);
    return reply.status(201).send(result);
  });
}

// ─── Asset Version review actions ─────────────
// Mounted at /api/asset-versions by server.ts

export async function assetVersionRoutes(fastify: FastifyInstance) {
  const auth = { onRequest: [fastify.authenticate] };

  // POST /asset-versions/:versionId/approve
  fastify.post('/:versionId/approve', {
    ...auth,
    schema: {
      tags: ['Reviews'],
      summary: 'Approve an asset version (comment optional)',
      body: {
        type: 'object',
        properties: { comment: { type: 'string' } },
      },
    },
  }, async (req, reply) => {
    const { versionId } = req.params as { versionId: string };
    const { comment } = (req.body as any) ?? {};
    const userId = (req.user as any).sub;
    const review = await approveVersion(versionId, userId, comment);
    return reply.status(201).send({ review });
  });

  // POST /asset-versions/:versionId/reject
  fastify.post('/:versionId/reject', {
    ...auth,
    schema: {
      tags: ['Reviews'],
      summary: 'Reject an asset version (comment required)',
      body: {
        type: 'object',
        required: ['comment'],
        properties: { comment: { type: 'string', minLength: 1 } },
      },
    },
  }, async (req, reply) => {
    const { versionId } = req.params as { versionId: string };
    const { comment } = req.body as { comment: string };
    const userId = (req.user as any).sub;
    const review = await rejectVersion(versionId, userId, comment);
    return reply.status(201).send({ review });
  });

  // POST /asset-versions/:versionId/request-revision
  fastify.post('/:versionId/request-revision', {
    ...auth,
    schema: {
      tags: ['Reviews'],
      summary: 'Request revision on an asset version (comment required)',
      body: {
        type: 'object',
        required: ['comment'],
        properties: { comment: { type: 'string', minLength: 1 } },
      },
    },
  }, async (req, reply) => {
    const { versionId } = req.params as { versionId: string };
    const { comment } = req.body as { comment: string };
    const userId = (req.user as any).sub;
    const review = await requestRevision(versionId, userId, comment);
    return reply.status(201).send({ review });
  });

  // GET /asset-versions/:versionId
  fastify.get('/:versionId', {
    ...auth,
    schema: { tags: ['Reviews'], summary: 'Get details for a specific asset version' },
  }, async (req, reply) => {
    const { versionId } = req.params as { versionId: string };
    const version = await getVersion(versionId);
    return reply.send({ version });
  });
}
