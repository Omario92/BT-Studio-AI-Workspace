import prisma from '../../config/database';
import { Errors } from '../../utils/errors';
import { Prisma, JobStatus, JobType } from '@prisma/client';
import { enqueueJob, cancelQueueJob } from './jobs.queue';

export interface CreateJobInput {
  name?: string;
  type: JobType;
  projectId: string;
  toolId?: string;
  params: Record<string, unknown>;
}

export async function createJob(input: CreateJobInput, userId: string) {
  const job = await prisma.aIJob.create({
    data: {
      ...input,
      params: input.params as Prisma.InputJsonValue,
      userId,
      status: JobStatus.QUEUED,
    },
    include: {
      tool: { select: { id: true, name: true, slug: true } },
      project: { select: { id: true, name: true } },
    },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      action: 'started job',
      entityType: 'job',
      entityId: job.id,
      detail: `${job.type}${input.name ? ` · ${input.name}` : ''}`,
      userId,
      projectId: input.projectId,
      jobId: job.id,
    },
  });

  // Enqueue into BullMQ
  const queueJobId = await enqueueJob(job.id, job.type);
  await prisma.aIJob.update({ where: { id: job.id }, data: { queueJobId } });

  return { ...job, queueJobId };
}

export async function getJob(id: string, userId: string) {
  const job = await prisma.aIJob.findUnique({
    where: { id },
    include: {
      tool: { select: { id: true, name: true, slug: true } },
      project: { select: { id: true, name: true } },
      assets: {
        select: { id: true, name: true, fileUrl: true, status: true, currentVersion: true },
      },
    },
  });
  if (!job) throw Errors.NotFound('Job not found');
  if (job.userId !== userId) throw Errors.Forbidden('Access denied');
  return job;
}

export async function listJobs(
  projectId: string | undefined,
  userId: string,
  page = 1,
  limit = 20,
) {
  const skip = (page - 1) * limit;
  const where: any = { userId };
  if (projectId) where.projectId = projectId;

  const [jobs, total] = await Promise.all([
    prisma.aIJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        tool: { select: { id: true, name: true, slug: true } },
        project: { select: { id: true, name: true } },
        _count: { select: { assets: true } },
      },
    }),
    prisma.aIJob.count({ where }),
  ]);

  return { jobs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function cancelJob(id: string, userId: string) {
  const job = await prisma.aIJob.findUnique({ where: { id } });
  if (!job) throw Errors.NotFound('Job not found');
  if (job.userId !== userId) throw Errors.Forbidden('Access denied');
  if (!([JobStatus.QUEUED, JobStatus.RUNNING] as JobStatus[]).includes(job.status)) {
    throw Errors.BadRequest('Only QUEUED or RUNNING jobs can be cancelled');
  }

  if (job.queueJobId) {
    await cancelQueueJob(job.queueJobId).catch(() => {});
  }

  const updated = await prisma.aIJob.update({
    where: { id },
    data: { status: JobStatus.CANCELLED, completedAt: new Date() },
  });

  await prisma.activityLog.create({
    data: {
      action: 'cancelled job',
      entityType: 'job',
      entityId: id,
      userId,
      projectId: job.projectId,
      jobId: id,
    },
  });

  return updated;
}

export async function retryJob(id: string, userId: string) {
  const job = await prisma.aIJob.findUnique({ where: { id } });
  if (!job) throw Errors.NotFound('Job not found');
  if (job.userId !== userId) throw Errors.Forbidden('Access denied');
  if (job.status !== JobStatus.FAILED) {
    throw Errors.BadRequest('Only FAILED jobs can be retried');
  }

  await prisma.aIJob.update({
    where: { id },
    data: { status: JobStatus.QUEUED, errorMsg: null, startedAt: null, completedAt: null },
  });

  const queueJobId = await enqueueJob(job.id, job.type);
  await prisma.aIJob.update({ where: { id }, data: { queueJobId } });

  await prisma.activityLog.create({
    data: {
      action: 'retried job',
      entityType: 'job',
      entityId: id,
      userId,
      projectId: job.projectId,
      jobId: id,
    },
  });

  return prisma.aIJob.findUnique({ where: { id } });
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
