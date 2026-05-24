import { FastifyInstance } from 'fastify';
import { JobType } from '@prisma/client';
import { createJob, getJob, listJobs, cancelJob, getQueueStats } from './jobs.service';

export async function jobRoutes(fastify: FastifyInstance) {
  const auth = { onRequest: [fastify.authenticate] };

  // GET /jobs/queue-stats  (admin only)
  fastify.get('/queue-stats', {
    onRequest: [fastify.authenticate, fastify.requireRole(['ADMIN'])],
    schema: { tags: ['Jobs'], summary: 'Get live BullMQ queue statistics' },
  }, async (_req, reply) => {
    const stats = await getQueueStats();
    return reply.send({ stats });
  });

  // POST /jobs
  fastify.post('/', {
    ...auth,
    schema: {
      tags: ['Jobs'],
      summary: 'Create and enqueue an AI generation job',
      body: {
        type: 'object',
        required: ['type', 'projectId', 'params'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: Object.values(JobType) },
          projectId: { type: 'string' },
          toolId: { type: 'string' },
          params: { type: 'object' },
        },
      },
    },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const job = await createJob(req.body as any, userId);
    return reply.status(202).send({ job });
  });

  // GET /jobs — list jobs for a project
  fastify.get('/', {
    ...auth,
    schema: {
      tags: ['Jobs'],
      summary: 'List AI jobs for a project',
      querystring: {
        type: 'object',
        required: ['projectId'],
        properties: {
          projectId: { type: 'string' },
          page: { type: 'string' },
          limit: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { projectId, page = '1', limit = '20' } = req.query as any;
    const result = await listJobs(projectId, userId, parseInt(page), parseInt(limit));
    return reply.send(result);
  });

  // GET /jobs/:id
  fastify.get('/:id', {
    ...auth,
    schema: { tags: ['Jobs'], summary: 'Get job status and result' },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as { id: string };
    const job = await getJob(id, userId);
    return reply.send({ job });
  });

  // POST /jobs/:id/cancel
  fastify.post('/:id/cancel', {
    ...auth,
    schema: { tags: ['Jobs'], summary: 'Cancel a pending or running job' },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as { id: string };
    const job = await cancelJob(id, userId);
    return reply.send({ job });
  });
}
