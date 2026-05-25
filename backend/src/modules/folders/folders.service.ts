import prisma from '../../config/database';
import { Errors } from '../../utils/errors';
import { assertProjectAccess } from '../projects/projects.service';

export interface CreateFolderInput {
  name: string;
  parentId?: string;
}

export async function createFolder(projectId: string, userId: string, data: CreateFolderInput) {
  await assertProjectAccess(projectId, userId);

  let depth = 0;
  if (data.parentId) {
    const parent = await prisma.folder.findUnique({ where: { id: data.parentId } });
    if (!parent || parent.projectId !== projectId) throw Errors.NotFound('Parent folder not found');
    depth = parent.depth + 1;
  }

  const folder = await prisma.folder.create({
    data: {
      name: data.name,
      projectId,
      parentId: data.parentId ?? null,
      depth,
    },
    include: { _count: { select: { assets: true } } },
  });

  await prisma.activityLog.create({
    data: {
      action: 'folder_created',
      entityType: 'folder',
      entityId: folder.id,
      detail: `Folder "${folder.name}" created`,
      userId,
      projectId,
    },
  });

  return folder;
}

export async function renameFolder(folderId: string, userId: string, data: { name: string }) {
  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) throw Errors.NotFound('Folder not found');
  await assertProjectAccess(folder.projectId, userId);

  const updated = await prisma.folder.update({
    where: { id: folderId },
    data: { name: data.name, updatedAt: new Date() },
    include: { _count: { select: { assets: true } } },
  });

  await prisma.activityLog.create({
    data: {
      action: 'folder_renamed',
      entityType: 'folder',
      entityId: folderId,
      detail: `Folder renamed to "${data.name}"`,
      userId,
      projectId: folder.projectId,
    },
  });

  return updated;
}

export async function deleteFolder(folderId: string, userId: string, force = false) {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    include: { _count: { select: { assets: true } } },
  });
  if (!folder) throw Errors.NotFound('Folder not found');
  await assertProjectAccess(folder.projectId, userId);

  if (folder._count.assets > 0 && !force) {
    throw Errors.BadRequest(
      `Folder contains ${folder._count.assets} asset(s). Use force=true to delete anyway.`
    );
  }

  await prisma.activityLog.create({
    data: {
      action: 'folder_deleted',
      entityType: 'folder',
      entityId: folderId,
      detail: `Folder "${folder.name}" deleted`,
      userId,
      projectId: folder.projectId,
    },
  });

  await prisma.folder.delete({ where: { id: folderId } });
}
