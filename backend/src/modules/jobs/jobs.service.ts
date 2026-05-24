import prisma from '../../config/database';
import { Errors } from '../../utils/errors';
import { JobStatus, JobType } from '@prisma/client';
import { enqueueJob, cancelQueueJob } from './jobs.queue';

export interface CreateJobInput {
  name?: string;
  type: JobType;
  projectId: string;
  toolId?: string;
  params: Record<string, unknown>;
}

export async function createJob(input: CreateJobInput, userId: string) {
  const job = await prisma.batchJob.create({
    data: {
      ...input,
      userId,
      status: JobStatus.PENDING,
    },
    include: {
      tool: { select: { id: true, name: true, slug: true } },
      project: { select: { id: true, name: true } },
    },
  });

  // Enqueue into BullMQ
  const queueJobId = await enqueueJob(job.id, job.type);
  await prisma.batchJob.update({ where: { id: job.id }, data: { queueJobId } });

  return { ...job, queueJobId };
}

export async function getJob(id: string, userId: string) {
  const job = await prisma.batchJob.findUnique({
    where: { id },
    include: {
      tool: { select: { id: true, name: true, slug: true } },
      project: { select: { id: true, name: true } },
      assets: {
        select: { id: true, name: true, fileUrl: true, status: true, version: true },
      },
    },
  });
  if (!job) throw Errors.NotFound('Job not found');
  if (job.userId !== userId) throw Errors.Forbidden('Access denied');
  return job;
}

export async function listJobs(projectId: string, userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [jobs, total] = await Promise.all([
    prisma.batchJob.findMany({
      where: { projectId, userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        tool: { select: { id: true, name: true, slug: true } },
        _count: { select: { assets: true } },
      },
    }),
    prisma.batchJob.count({ where: { projectId, userId } }),
  ]);

  return { jobs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function cancelJob(id: string, userId: string) {
  const job = await prisma.batchJob.findUnique({ where: { id } });
  if (!job) throw Errors.NotFound('Job not found');
  if (job.userId !== userId) throw Errors.Forbidden('Access denied');
  if (![JobStatus.PENDING, JobStatus.RUNNING].includes(job.status)) {
    throw Errors.BadRequest('Only PENDING or RUNNING jobs can be cancelled');
  }

  if (job.queueJobId) {
    await cancelQueueJob(job.queueJobId).catch(() => {});
  }

  return prisma.batchJob.update({
    where: { id },
    data: { status: JobStatus.CANCELLED, completedAt: new Date() },
  });
}

export async function getQueueStats() {
  const { jobQueue } = await import('./jobs.queue');
  const [waiting, active, completed, failed] = await Promise.all([
    jobQueue.getWaitingCount(),
    jobQueue.getActiveCount(),
    jobQueue.getCompletedCount(),
    jobQueue.getFailedCount(),
  ]);
  return { waiting, active, completed, failed };
}
