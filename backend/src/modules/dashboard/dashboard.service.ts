import prisma from '../../config/database';
import { AssetStatus, JobStatus } from '@prisma/client';

export async function getDashboardSummary(userId: string) {
  const [
    activeProjects,
    awaitingApproval,
    assignmentsDue,
    generatedLast7d,
    gpuQueueStats,
    recentProjects,
    recentActivity,
  ] = await Promise.all([
    // Active projects the user belongs to
    prisma.project.count({
      where: {
        status: { in: ['ACTIVE', 'WIP'] },
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
    }),

    // Assets awaiting approval (IN_REVIEW)
    prisma.asset.count({
      where: {
        status: AssetStatus.IN_REVIEW,
        project: {
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
      },
    }),

    // Open assignments for this user due soon
    prisma.assignment.count({
      where: { assigneeId: userId, isDone: false },
    }),

    // Jobs completed in last 7 days (approximates "frames generated")
    prisma.aIJob.count({
      where: {
        status: JobStatus.COMPLETED,
        completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),

    // Live queue: running + queued jobs
    prisma.aIJob.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: { status: { in: [JobStatus.RUNNING, JobStatus.QUEUED] } },
    }),

    // 4 most recent projects
    prisma.project.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
      take: 4,
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true } },
        members: {
          take: 4,
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        _count: { select: { assets: true } },
      },
    }),

    // Recent activity across the user's projects
    prisma.activityLog.findMany({
      where: {
        project: {
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        asset: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    }),
  ]);

  const queueMap = Object.fromEntries(gpuQueueStats.map(s => [s.status, s._count._all]));

  return {
    kpi: {
      activeProjects,
      framesGenerated7d: generatedLast7d,
      awaitingApproval,
      gpuQueueRunning: queueMap['RUNNING'] ?? 0,
      gpuQueueQueued: queueMap['QUEUED'] ?? 0,
    },
    assignments: await prisma.assignment.findMany({
      where: { assigneeId: userId, isDone: false },
      orderBy: { dueAt: 'asc' },
      take: 4,
      include: { project: { select: { id: true, name: true } } },
    }),
    recentProjects,
    recentActivity,
  };
}
