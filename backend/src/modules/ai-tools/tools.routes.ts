import { FastifyInstance } from 'fastify';
import {
  listTools, getTool, createTool,
  updateTool, deleteTool,
  getProviderStatus, invokeToolDirect,
} from './tools.service';

export async function toolRoutes(fastify: FastifyInstance) {
  const auth = { onRequest: [fastify.authenticate] };
  const adminAuth = { onRequest: [fastify.authenticate, fastify.requireRole(['ADMIN'])] };

  // GET /tools — public list (authenticated)
  fastify.get('/', {
    ...auth,
    schema: {
      tags: ['AI Tools'],
      summary: 'List all active AI tools',
      querystring: {
        type: 'object',
        properties: { all: { type: 'string' } },
      },
    },
  }, async (req, reply) => {
    const { all } = req.query as { all?: string };
    const tools = await listTools(all !== 'true');
    return reply.send({ tools });
  });

  // GET /tools/provider-status
  fastify.get('/provider-status', {
    ...adminAuth,
    schema: { tags: ['AI Tools'], summary: 'Check AI provider API key configuration' },
  }, async (_req, reply) => {
    const status = await getProviderStatus();
    return reply.send({ status });
  });

  // GET /tools/:id
  fastify.get('/:id', {
    ...auth,
    schema: { tags: ['AI Tools'], summary: 'Get tool details' },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tool = await getTool(id);
    return reply.send({ tool });
  });

  // POST /tools  (admin only)
  fastify.post('/', {
    ...adminAuth,
    schema: {
      tags: ['AI Tools'],
      summary: 'Register a new AI tool (admin)',
      body: {
        type: 'object',
        required: ['name', 'slug'],
        properties: {
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          provider: { type: 'string' },
          modelId: { type: 'string' },
          config: { type: 'object' },
        },
      },
    },
  }, async (req, reply) => {
    const tool = await createTool(req.body as any);
    return reply.status(201).send({ tool });
  });

  // PATCH /tools/:id  (admin only)
  fastify.patch('/:id', {
    ...adminAuth,
    schema: { tags: ['AI Tools'], summary: 'Update AI tool config (admin)' },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tool = await updateTool(id, req.body as any);
    return reply.send({ tool });
  });

  // DELETE /tools/:id  (admin only)
  fastify.delete('/:id', {
    ...adminAuth,
    schema: { tags: ['AI Tools'], summary: 'Remove AI tool (admin)' },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await deleteTool(id);
    return reply.status(204).send();
  });

  // POST /tools/:slug/invoke  — direct synchronous invocation (test/preview)
  fastify.post('/:slug/invoke', {
    ...auth,
    schema: {
      tags: ['AI Tools'],
      summary: 'Directly invoke a tool (preview/test only — use /jobs for production)',
      params: { type: 'object', properties: { slug: { type: 'string' } } },
      body: { type: 'object', properties: { params: { type: 'object' } } },
    },
  }, async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const { params = {} } = req.body as { params?: Record<string, unknown> };
    const result = await invokeToolDirect(slug, params);
    return reply.send({ result });
  });
}
