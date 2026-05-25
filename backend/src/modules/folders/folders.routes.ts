import { FastifyInstance } from 'fastify';
import { renameFolder, deleteFolder } from './folders.service';

export async function folderRoutes(fastify: FastifyInstance) {
  const auth = { onRequest: [fastify.authenticate] };

  // PATCH /api/folders/:folderId
  fastify.patch('/:folderId', {
    ...auth,
    schema: {
      tags: ['Folders'],
      summary: 'Rename a folder',
      body: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' } },
      },
    },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { folderId } = req.params as { folderId: string };
    const folder = await renameFolder(folderId, userId, req.body as any);
    return reply.send({ folder });
  });

  // DELETE /api/folders/:folderId
  fastify.delete('/:folderId', {
    ...auth,
    schema: {
      tags: ['Folders'],
      summary: 'Delete a folder (blocked if it has assets, unless force=true)',
      querystring: {
        type: 'object',
        properties: { force: { type: 'boolean' } },
      },
    },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { folderId } = req.params as { folderId: string };
    const { force } = req.query as { force?: boolean };
    await deleteFolder(folderId, userId, force);
    return reply.status(204).send();
  });
}
