import prisma from '../../config/database';
import { Errors } from '../../utils/errors';
import { ProjectStatus } from '@prisma/client';

export interface CreateProjectInput {
  name: string;
  client: string;
  description?: string;
  tone?: string;
}

export interface UpdateProjectInput {
  name?: string;
  client?: string;
  description?: string;
  status?: ProjectStatus;
  progress?: number;
  tone?: string;
  isPinned?: boolean;
}

export async function listProjects(userId: string, page = 1, limit = 20) {
  const skip = (page - 1) * limit;

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
      skip,
      take: limit,
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true } },
        members: {
          take: 5,
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        _count: { select: { assets: true, batchJobs: true } },
      },
    }),
    prisma.project.count({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
    }),
  ]);

  return {
    projects,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getProject(id: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
      members: { include: { user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } } } },
      folders: { where: { parentId: null }, include: { children: true } },
      _count: { select: { assets: true, batchJobs: true } },
    },
  });
  if (!project) throw Errors.NotFound('Project not found');
  return project;
}

export async function createProject(ownerId: string, data: CreateProjectInput) {
  return prisma.project.create({
    data: { ...data, ownerId },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

export async function updateProject(id: string, userId: string, data: UpdateProjectInput) {
  await assertProjectAccess(id, userId);
  return prisma.project.update({
    where: { id },
    data: { ...data, updatedAt: new Date() },
  });
}

export async function deleteProject(id: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw Errors.NotFound('Project not found');
  if (project.ownerId !== userId) throw Errors.Forbidden('Only the project owner can delete it');
  await prisma.project.delete({ where: { id } });
}

export async function getProjectActivity(projectId: string, userId: string, limit = 30) {
  await assertProjectAccess(projectId, userId);
  return prisma.activityLog.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      asset: { select: { id: true, name: true } },
    },
  });
}

// ─── Helpers ─────────────────────────────────

async function assertProjectAccess(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
  });
  if (!project) throw Errors.NotFound('Project not found');
  return project;
}
