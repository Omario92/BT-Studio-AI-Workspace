import { Queue, Worker, QueueEvents } from 'bullmq';
import { redis } from '../../config/redis';
import prisma from '../../config/database';
import { Prisma, JobStatus, JobType } from '@prisma/client';
import { processAIJob } from './jobs.processor';
import logger from '../../utils/logger';

export const JOB_QUEUE_NAME = 'bt-studio-jobs';

export let jobQueue: Queue | null = null;
export let jobWorker: Worker | null = null;
export let queueEvents: QueueEvents | null = null;

if (process.env.DISABLE_REDIS !== 'true') {
  // ─── Queue ───────────────────────────────────
  jobQueue = new Queue(JOB_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  });

  // ─── Worker ──────────────────────────────────
  jobWorker = new Worker(
    JOB_QUEUE_NAME,
    async (job) => {
      const { jobId } = job.data as { jobId: string };
      logger.info({ jobId, bullmqId: job.id }, 'Processing AI job');

      // Mark DB job as RUNNING
      await prisma.aIJob.update({
        where: { id: jobId },
        data: { status: JobStatus.RUNNING, startedAt: new Date(), queueJobId: job.id },
      });

      try {
        const result = await processAIJob(jobId, (progress) => {
          job.updateProgress(progress);
          prisma.aIJob.update({
            where: { id: jobId },
            data: { progress },
          }).catch(() => {});
        });

        await prisma.aIJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.COMPLETED,
            progress: 100,
            result: result as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        });

        logger.info({ jobId }, 'AI job completed');
        return result;
      } catch (err: any) {
        await prisma.aIJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.FAILED,
            errorMsg: err?.message ?? 'Unknown error',
            completedAt: new Date(),
          },
        });
        throw err;
      }
    },
    { connection: redis, concurrency: 4 },
  );

  // ─── Queue Events ─────────────────────────────
  queueEvents = new QueueEvents(JOB_QUEUE_NAME, { connection: redis });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error({ jobId, failedReason }, 'Queue job failed');
  });
}

// ─── Helper: enqueue a new AI job ────────────

export async function enqueueJob(jobId: string, type: JobType) {
  if (process.env.DISABLE_REDIS === 'true') {
    // In-memory mock async processing for local dev when Redis is off
    const mockId = `mock_q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    
    // Simulate async processor after 500ms
    setTimeout(async () => {
      try {
        // Mark DB job as RUNNING
        await prisma.aIJob.update({
          where: { id: jobId },
          data: { status: JobStatus.RUNNING, startedAt: new Date() },
        });

        // Process job using processAIJob directly
        const result = await processAIJob(jobId, (progress) => {
          prisma.aIJob.update({
            where: { id: jobId },
            data: { progress },
          }).catch(() => {});
        });

        // Mark COMPLETED
        await prisma.aIJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.COMPLETED,
            progress: 100,
            result: result as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        });
      } catch (err: any) {
        await prisma.aIJob.update({
          where: { id: jobId },
          data: {
            status: JobStatus.FAILED,
            errorMsg: err?.message ?? 'Unknown error',
            completedAt: new Date(),
          },
        });
      }
    }, 500);

    return mockId;
  }

  if (!jobQueue) {
    throw new Error('BullMQ job queue is not initialized');
  }

  const queueJob = await jobQueue.add(
    type,
    { jobId },
    { priority: type === 'BATCH_GENERATION' ? 1 : 5 },
  );
  return queueJob.id;
}

// ─── Helper: cancel a queued job ─────────────

export async function cancelQueueJob(queueJobId: string) {
  if (process.env.DISABLE_REDIS === 'true') {
    return;
  }

  if (!jobQueue) {
    return;
  }

  const job = await jobQueue.getJob(queueJobId);
  if (job) await job.remove();
}
