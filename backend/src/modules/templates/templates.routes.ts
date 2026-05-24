import { FastifyInstance } from 'fastify';
import prisma from '../../config/database';

export async function templateRoutes(fastify: FastifyInstance) {
  const auth = { onRequest: [fastify.authenticate] };

  // GET /api/templates
  fastify.get('/', {
    ...auth,
    schema: {
      tags: ['Templates'],
      summary: 'List all active templates',
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          limit: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { category, limit = '50' } = req.query as any;

    const where: any = { isActive: true };
    if (category) where.category = { equals: category, mode: 'insensitive' };

    const templates = await prisma.template.findMany({
      where,
      orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
      take: Math.min(parseInt(limit), 100),
    });

    return reply.send({ templates });
  });

  // GET /api/templates/:id
  fastify.get('/:id', {
    ...auth,
    schema: { tags: ['Templates'], summary: 'Get template details' },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const template = await prisma.template.findUnique({ where: { id } });
    if (!template) return reply.status(404).send({ error: { message: 'Template not found' } });
    return reply.send({ template });
  });
}
