import { FastifyInstance } from 'fastify';
import prisma from '../../config/database';

export async function activityRoutes(fastify: FastifyInstance) {
  const auth = { onRequest: [fastify.authenticate] };

  // GET /api/activity
  // Optional query: projectId, userId, limit, offset
  fastify.get('/', {
    ...auth,
    schema: {
      tags: ['Activity'],
      summary: 'Get activity log across all accessible projects',
      querystring: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          userId: { type: 'string' },
          action: { type: 'string' },
          limit: { type: 'string' },
          offset: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const currentUserId = (req.user as any).sub;
    const { projectId, userId, action, limit = '30', offset = '0' } = req.query as any;

    const where: any = {
      project: {
        OR: [{ ownerId: currentUserId }, { members: { some: { userId: currentUserId } } }],
      },
    };
    if (projectId) where.projectId = projectId;
    if (userId) where.userId = userId;
    if (action) where.action = { contains: action, mode: 'insensitive' };

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(parseInt(limit), 100),
        skip: parseInt(offset),
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          asset: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          job: { select: { id: true, type: true, name: true } },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return reply.send({ logs, total });
  });
}
