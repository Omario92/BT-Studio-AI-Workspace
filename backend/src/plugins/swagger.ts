import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { FastifyInstance } from 'fastify';

export default fp(async (fastify: FastifyInstance) => {
  fastify.register(swagger, {
    openapi: {
      info: {
        title: 'BT Studio AI Workspace API',
        description: 'Backend API for BT Studio AI — projects, assets, batch AI jobs, and tool integrations',
        version: '1.0.0',
      },
      servers: [{ url: 'http://localhost:3001', description: 'Local development' }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
      tags: [
        { name: 'Auth',     description: 'Authentication & user session' },
        { name: 'Projects', description: 'Project management' },
        { name: 'Assets',   description: 'Asset management & approval' },
        { name: 'Jobs',     description: 'AI generation job queue' },
        { name: 'AI Tools', description: 'AI tool registry' },
        { name: 'Health',   description: 'System health' },
      ],
    },
  });

  fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
    staticCSP: true,
  });
});
