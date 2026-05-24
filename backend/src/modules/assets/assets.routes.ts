import { FastifyInstance } from 'fastify';
import {
  getAsset, createAsset, deleteAsset,
  listVersions, createVersion,
  addComment,
  sendToReview, approveVersion, rejectVersion, requestRevision,
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
}
