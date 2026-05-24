import { FastifyInstance } from 'fastify';
import {
  listProjects, getProject, createProject,
  updateProject, deleteProject, getProjectActivity,
} from './projects.service';
import { listAssets, createAsset } from '../assets/assets.service';

export async function projectRoutes(fastify: FastifyInstance) {
  const auth = { onRequest: [fastify.authenticate] };

  // GET /projects
  fastify.get('/', {
    ...auth,
    schema: { tags: ['Projects'], summary: 'List all accessible projects' },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { page = '1', limit = '20' } = req.query as any;
    const result = await listProjects(userId, parseInt(page), parseInt(limit));
    return reply.send(result);
  });

  // POST /projects
  fastify.post('/', {
    ...auth,
    schema: {
      tags: ['Projects'],
      summary: 'Create a new project',
      body: {
        type: 'object',
        required: ['name', 'client'],
        properties: {
          name: { type: 'string' },
          client: { type: 'string' },
          description: { type: 'string' },
          tone: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const project = await createProject(userId, req.body as any);
    return reply.status(201).send({ project });
  });

  // GET /projects/:id
  fastify.get('/:id', {
    ...auth,
    schema: { tags: ['Projects'], summary: 'Get project details' },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as { id: string };
    const project = await getProject(id, userId);
    return reply.send({ project });
  });

  // PATCH /projects/:id
  fastify.patch('/:id', {
    ...auth,
    schema: { tags: ['Projects'], summary: 'Update project' },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as { id: string };
    const project = await updateProject(id, userId, req.body as any);
    return reply.send({ project });
  });

  // DELETE /projects/:id
  fastify.delete('/:id', {
    ...auth,
    schema: { tags: ['Projects'], summary: 'Delete project (owner only)' },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as { id: string };
    await deleteProject(id, userId);
    return reply.status(204).send();
  });

  // GET /projects/:id/activity
  fastify.get('/:id/activity', {
    ...auth,
    schema: { tags: ['Projects'], summary: 'Get project activity log' },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as { id: string };
    const { limit = '30' } = req.query as any;
    const logs = await getProjectActivity(id, userId, parseInt(limit));
    return reply.send({ logs });
  });

  // GET /projects/:id/assets
  fastify.get('/:id/assets', {
    ...auth,
    schema: { tags: ['Projects'], summary: 'List project assets' },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as { id: string };
    const query = req.query as any;
    const result = await listAssets({ ...query, projectId: id }, userId);
    return reply.send(result);
  });

  // POST /projects/:id/assets
  fastify.post('/:id/assets', {
    ...auth,
    schema: { tags: ['Projects'], summary: 'Add an asset to a project' },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as { id: string };
    const asset = await createAsset({ ...(req.body as any), projectId: id }, userId);
    return reply.status(201).send({ asset });
  });
}
