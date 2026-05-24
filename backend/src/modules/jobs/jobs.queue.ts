import { Queue, Worker, QueueEvents } from 'bullmq';
import { redis } from '../../config/redis';
import prisma from '../../config/database';
import { Prisma, JobStatus, JobType } from '@prisma/client';
import { processAIJob } from './jobs.processor';
import logger from '../../utils/logger';

export const JOB_QUEUE_NAME = 'bt-studio-jobs';

// ─── Queue ───────────────────────────────────

export const jobQueue = new Queue(JOB_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

// ─── Worker ──────────────────────────────────

export const jobWorker = new Worker(
  JOB_QUEUE_NAME,
  async (job) => {
    const { batchJobId } = job.data as { batchJobId: string };
    logger.info({ batchJobId, jobId: job.id }, 'Processing AI job');

    // Mark DB job as RUNNING
    await prisma.batchJob.update({
      where: { id: batchJobId },
      data: { status: JobStatus.RUNNING, startedAt: new Date(), queueJobId: job.id },
    });

    try {
      const result = await processAIJob(batchJobId, (progress) => {
        job.updateProgress(progress);
        prisma.batchJob.update({
          where: { id: batchJobId },
          data: { progress },
        }).catch(() => {});
      });

      await prisma.batchJob.update({
        where: { id: batchJobId },
        data: {
          status: JobStatus.COMPLETED,
          progress: 100,
          result: result as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });

      logger.info({ batchJobId }, 'AI job completed');
      return result;
    } catch (err: any) {
      await prisma.batchJob.update({
        where: { id: batchJobId },
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

export const queueEvents = new QueueEvents(JOB_QUEUE_NAME, { connection: redis });

queueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error({ jobId, failedReason }, 'Queue job failed');
});

// ─── Helper: enqueue a new AI job ────────────

export async function enqueueJob(batchJobId: string, type: JobType) {
  const queueJob = await jobQueue.add(
    type,
    { batchJobId },
    { priority: type === 'BATCH_RENDER' ? 1 : 5 },
  );
  return queueJob.id;
}

// ─── Helper: cancel a queued job ─────────────

export async function cancelQueueJob(queueJobId: string) {
  const job = await jobQueue.getJob(queueJobId);
  if (job) await job.remove();
}
