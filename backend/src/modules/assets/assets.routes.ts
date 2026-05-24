import { FastifyInstance } from 'fastify';
import { AssetStatus } from '@prisma/client';
import {
  getAsset, updateAssetStatus,
  bumpAssetVersion, addComment, deleteAsset,
} from './assets.service';

export async function assetRoutes(fastify: FastifyInstance) {
  const auth = { onRequest: [fastify.authenticate] };

  // GET /assets/:id
  fastify.get('/:id', {
    ...auth,
    schema: { tags: ['Assets'], summary: 'Get asset details with comments' },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const asset = await getAsset(id);
    return reply.send({ asset });
  });

  // PATCH /assets/:id/status
  fastify.patch('/:id/status', {
    ...auth,
    schema: {
      tags: ['Assets'],
      summary: 'Update asset status (approve, reject, etc.)',
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: Object.values(AssetStatus) },
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: AssetStatus };
    const userId = (req.user as any).sub;
    const asset = await updateAssetStatus(id, status, userId);
    return reply.send({ asset });
  });

  // POST /assets/:id/version-bump
  fastify.post('/:id/version-bump', {
    ...auth,
    schema: { tags: ['Assets'], summary: 'Increment asset version counter' },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const asset = await bumpAssetVersion(id);
    return reply.send({ asset });
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
}
