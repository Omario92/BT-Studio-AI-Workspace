import prisma from '../../config/database';
import { Errors } from '../../utils/errors';
import { AssetStatus } from '@prisma/client';

export interface CreateAssetInput {
  name: string;
  projectId: string;
  folderId?: string;
  fileUrl?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  metadata?: Record<string, unknown>;
}

export interface ListAssetsQuery {
  projectId?: string;
  folderId?: string;
  status?: AssetStatus;
  page?: string;
  limit?: string;
}

export async function listAssets(query: ListAssetsQuery, _userId: string) {
  const page = parseInt(query.page ?? '1', 10);
  const limit = Math.min(parseInt(query.limit ?? '50', 10), 100);
  const skip = (page - 1) * limit;

  const where: any = {};
  if (query.projectId) where.projectId = query.projectId;
  if (query.folderId) where.folderId = query.folderId;
  if (query.status) where.status = query.status;

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        folder: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.asset.count({ where }),
  ]);

  return {
    assets,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getAsset(id: string) {
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, avatarUrl: true } },
      folder: { select: { id: true, name: true } },
      job: { select: { id: true, type: true, status: true, params: true } },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });
  if (!asset) throw Errors.NotFound('Asset not found');
  return asset;
}

export async function createAsset(data: CreateAssetInput, creatorId: string) {
  return prisma.asset.create({
    data: {
      ...data,
      creatorId,
      status: AssetStatus.DRAFT,
      version: 1,
    },
    include: {
      creator: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

export async function updateAssetStatus(id: string, status: AssetStatus, userId: string) {
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) throw Errors.NotFound('Asset not found');

  const updated = await prisma.asset.update({
    where: { id },
    data: { status },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      action: status.toLowerCase(),
      entityType: 'asset',
      entityId: id,
      userId,
      projectId: asset.projectId,
      assetId: id,
    },
  });

  return updated;
}

export async function bumpAssetVersion(id: string) {
  return prisma.asset.update({
    where: { id },
    data: { version: { increment: 1 } },
  });
}

export async function addComment(assetId: string, body: string, authorId: string) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw Errors.NotFound('Asset not found');

  const comment = await prisma.comment.create({
    data: { body, assetId, authorId },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });

  await prisma.activityLog.create({
    data: {
      action: 'commented on',
      entityType: 'asset',
      entityId: assetId,
      detail: body.slice(0, 100),
      userId: authorId,
      projectId: asset.projectId,
      assetId,
    },
  });

  return comment;
}

export async function deleteAsset(id: string, userId: string) {
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) throw Errors.NotFound('Asset not found');
  if (asset.creatorId !== userId) throw Errors.Forbidden('Only the asset creator can delete it');
  await prisma.asset.delete({ where: { id } });
}
