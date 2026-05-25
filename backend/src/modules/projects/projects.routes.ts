import { FastifyInstance } from 'fastify';
import {
  listProjects, getProject, createProject,
  updateProject, deleteProject, getProjectActivity,
  getProjectFolders,
} from './projects.service';
import { createFolder } from '../folders/folders.service';
import { listAssets, createAsset } from '../assets/assets.service';

export async function projectRoutes(fastify: FastifyInstance) {
  const auth = { onRequest: [fastify.authenticate] };

  // GET /api/projects
  fastify.get('/', {
    ...auth,
    schema: { tags: ['Projects'], summary: 'List all accessible projects' },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { page = '1', limit = '20' } = req.query as any;
    const result = await listProjects(userId, parseInt(page), parseInt(limit));
    return reply.send(result);
  });

  // POST /api/projects
  fastify.post('/', {
    ...auth,
    schema: {
      tags: ['Projects'],
      summary: 'Create a new project (also creates default folders)',
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

  // GET /api/projects/:id
  fastify.get('/:id', {
    ...auth,
    schema: { tags: ['Projects'], summary: 'Get project details' },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as { id: string };
    const project = await getProject(id, userId);
    return reply.send({ project });
  });

  // PATCH /api/projects/:id
  fastify.patch('/:id', {
    ...auth,
    schema: { tags: ['Projects'], summary: 'Update project metadata or status' },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as { id: string };
    const project = await updateProject(id, userId, req.body as any);
    return reply.send({ project });
  });

  // DELETE /api/projects/:id
  fastify.delete('/:id', {
    ...auth,
    schema: { tags: ['Projects'], summary: 'Delete project (owner only)' },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as { id: string };
    await deleteProject(id, userId);
    return reply.status(204).send();
  });

  // GET /api/projects/:id/folders
  fastify.get('/:id/folders', {
    ...auth,
    schema: { tags: ['Projects'], summary: 'List folders in a project' },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as { id: string };
    const folders = await getProjectFolders(id, userId);
    return reply.send({ folders });
  });

  // POST /api/projects/:id/folders
  fastify.post('/:id/folders', {
    ...auth,
    schema: {
      tags: ['Projects'],
      summary: 'Create a folder in a project',
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          parentId: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as { id: string };
    const folder = await createFolder(id, userId, req.body as any);
    return reply.status(201).send({ folder });
  });

  // GET /api/projects/:id/assets
  fastify.get('/:id/assets', {
    ...auth,
    schema: {
      tags: ['Projects'],
      summary: 'List project assets',
      querystring: {
        type: 'object',
        properties: {
          folderId: { type: 'string' },
          status: { type: 'string' },
          page: { type: 'string' },
          limit: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as { id: string };
    const query = req.query as any;
    const result = await listAssets({ ...query, projectId: id }, userId);
    return reply.send(result);
  });

  // POST /api/projects/:id/assets
  fastify.post('/:id/assets', {
    ...auth,
    schema: { tags: ['Projects'], summary: 'Add an asset to a project' },
  }, async (req, reply) => {
    const userId = (req.user as any).sub;
    const { id } = req.params as { id: string };
    const asset = await createAsset({ ...(req.body as any), projectId: id }, userId);
    return reply.status(201).send({ asset });
  });

  // GET /api/projects/:id/activity
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
}
