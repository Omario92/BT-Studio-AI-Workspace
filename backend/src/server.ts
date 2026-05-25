import 'dotenv/config';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';

import { env } from './config/env';
import { errorHandler } from './utils/errors';
import logger from './utils/logger';

// Plugins
import authPlugin    from './plugins/auth';
import corsPlugin    from './plugins/cors';
import swaggerPlugin from './plugins/swagger';

// Routes
import { authRoutes }          from './modules/auth/auth.routes';
import { dashboardRoutes }     from './modules/dashboard/dashboard.routes';
import { projectRoutes }       from './modules/projects/projects.routes';
import { assetRoutes, assetVersionRoutes } from './modules/assets/assets.routes';
import { jobRoutes }           from './modules/jobs/jobs.routes';
import { toolRoutes }          from './modules/ai-tools/tools.routes';
import { activityRoutes }      from './modules/activity/activity.routes';
import { templateRoutes }      from './modules/templates/templates.routes';
import { storageRoutes }       from './modules/storage/storage.routes';
import { folderRoutes }        from './modules/folders/folders.routes';

// ─── Build App ───────────────────────────────

export async function buildApp() {
  const fastify = Fastify({
    logger,
    trustProxy: true,
    ajv: {
      customOptions: {
        removeAdditional: 'all',
        coerceTypes: true,
        allErrors: false,
      },
    },
  });

  // ── Global error handler
  fastify.setErrorHandler(errorHandler);

  // ── Plugins (order matters)
  await fastify.register(corsPlugin);
  await fastify.register(swaggerPlugin);
  await fastify.register(authPlugin);
  await fastify.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, context) => ({
      error: {
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded — try again in ${context.after}`,
      },
    }),
  });

  // ── Routes
  fastify.register(authRoutes,         { prefix: '/api/auth' });
  fastify.register(dashboardRoutes,    { prefix: '/api/dashboard' });
  fastify.register(projectRoutes,      { prefix: '/api/projects' });
  fastify.register(assetRoutes,        { prefix: '/api/assets' });
  fastify.register(assetVersionRoutes, { prefix: '/api/asset-versions' });
  fastify.register(jobRoutes,          { prefix: '/api/jobs' });
  fastify.register(toolRoutes,         { prefix: '/api/tools' });
  fastify.register(activityRoutes,     { prefix: '/api/activity' });
  fastify.register(templateRoutes,     { prefix: '/api/templates' });
  fastify.register(storageRoutes,      { prefix: '/api/storage' });
  fastify.register(folderRoutes,       { prefix: '/api/folders' });

  // ── Health check
  fastify.get('/health', {
    schema: { tags: ['Health'], summary: 'Health check' },
  }, async () => ({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
  }));

  return fastify;
}

// ─── Start Server (if run directly) ─────────

async function start() {
  const app = await buildApp();

  let jobWorker: any = null;

  // Start BullMQ worker if Redis is enabled
  if (process.env.DISABLE_REDIS !== 'true') {
    const queueModule = await import('./modules/jobs/jobs.queue');
    jobWorker = queueModule.jobWorker;
    jobWorker.on('error', (err: Error) => logger.error({ err }, 'Worker error'));
  } else {
    logger.info('BullMQ queue worker is disabled via DISABLE_REDIS env');
  }

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(`🚀  BT Studio API running at http://${env.HOST}:${env.PORT}`);
    logger.info(`📖  Docs available at http://localhost:${env.PORT}/docs`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down…`);
    if (jobWorker) {
      await jobWorker.close();
    }
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

if (require.main === module) {
  start();
}
