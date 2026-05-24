import { FastifyInstance } from 'fastify';
import { getDashboardSummary } from './dashboard.service';

export async function dashboardRoutes(fastify: FastifyInstance) {
  const auth = { onRequest: [fastify.authenticate] };

  // GET /api/dashboard/summary
  fastify.get('/summary', {
    ...auth,
    schema: {
      tags: ['Dashboard'],
      summary: 'Dashboard KPIs, recent projects, assignments, and activity',
    },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const summary = await getDashboardSummary(userId);
    return reply.send(summary);
  });
}
