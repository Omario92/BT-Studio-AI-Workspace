import prisma from '../../config/database';
import { Errors } from '../../utils/errors';
import { AssetStatus, ReviewDecision } from '@prisma/client';

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
  search?: string;
  type?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: string;
  limit?: string;
}

// ─── Assets ──────────────────────────────────

export async function listAssets(query: ListAssetsQuery, _userId: string) {
  const page = parseInt(query.page ?? '1', 10);
  const limit = Math.min(parseInt(query.limit ?? '50', 10), 100);
  const skip = (page - 1) * limit;

  const where: any = {};
  if (query.projectId) where.projectId = query.projectId;
  if (query.folderId) where.folderId = query.folderId;
  if (query.status) where.status = query.status;

  if (query.search) {
    where.name = {
      contains: query.search,
      mode: 'insensitive',
    };
  }

  if (query.type && query.type !== 'all') {
    if (query.type === 'document') {
      where.AND = [
        { NOT: { mimeType: { startsWith: 'image/' } } },
        { NOT: { mimeType: { startsWith: 'video/' } } },
        { NOT: { mimeType: { startsWith: 'audio/' } } },
      ];
    } else {
      where.mimeType = {
        startsWith: `${query.type}/`,
      };
    }
  }

  let orderBy: any = { updatedAt: 'desc' };
  if (query.sortBy) {
    const allowedFields = ['name', 'createdAt', 'updatedAt', 'fileSizeBytes'];
    if (allowedFields.includes(query.sortBy)) {
      const order = query.sortOrder === 'asc' ? 'asc' : 'desc';
      orderBy = { [query.sortBy]: order };
    }
  }

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        folder: { select: { id: true, name: true } },
        _count: { select: { comments: true, versions: true } },
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
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 10,
        include: {
          reviews: {
            include: { reviewer: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
      },
    },
  });
  if (!asset) throw Errors.NotFound('Asset not found');
  return asset;
}

export async function createAsset(data: CreateAssetInput, creatorId: string) {
  const asset = await prisma.asset.create({
    data: {
      ...data,
      metadata: data.metadata as any,
      creatorId,
      status: AssetStatus.DRAFT,
      currentVersion: 1,
    },
    include: {
      creator: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  // Create initial version
  await prisma.assetVersion.create({
    data: {
      assetId: asset.id,
      versionNumber: 1,
      fileUrl: data.fileUrl,
      mimeType: data.mimeType,
      fileSizeBytes: data.fileSizeBytes,
      status: AssetStatus.DRAFT,
      createdById: creatorId,
    },
  });

  // Create ActivityLog entry for upload
  await prisma.activityLog.create({
    data: {
      action: 'uploaded',
      entityType: 'asset',
      entityId: asset.id,
      userId: creatorId,
      projectId: data.projectId,
      assetId: asset.id,
    },
  });

  return asset;
}

export async function deleteAsset(id: string, userId: string) {
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) throw Errors.NotFound('Asset not found');
  if (asset.creatorId !== userId) throw Errors.Forbidden('Only the asset creator can delete it');
  await prisma.asset.delete({ where: { id } });
}

// ─── Send to Review ───────────────────────────

export async function sendToReview(assetId: string, userId: string) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw Errors.NotFound('Asset not found');

  const updated = await prisma.asset.update({
    where: { id: assetId },
    data: { status: AssetStatus.IN_REVIEW },
  });

  await prisma.activityLog.create({
    data: {
      action: 'sent to review',
      entityType: 'asset',
      entityId: assetId,
      userId,
      projectId: asset.projectId,
      assetId,
    },
  });

  return updated;
}

// ─── Asset Versions ──────────────────────────

export async function listVersions(assetId: string) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw Errors.NotFound('Asset not found');

  return prisma.assetVersion.findMany({
    where: { assetId },
    orderBy: { versionNumber: 'desc' },
    include: {
      reviews: {
        include: { reviewer: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });
}

export async function createVersion(
  assetId: string,
  userId: string,
  data: {
    fileUrl?: string;
    mimeType?: string;
    fileSizeBytes?: number;
    params?: Record<string, unknown>;
    notes?: string;
    jobId?: string;
  },
) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw Errors.NotFound('Asset not found');

  const nextVersion = asset.currentVersion + 1;

  const [version] = await prisma.$transaction([
    prisma.assetVersion.create({
      data: {
        assetId,
        versionNumber: nextVersion,
        fileUrl: data.fileUrl,
        mimeType: data.mimeType,
        fileSizeBytes: data.fileSizeBytes,
        params: data.params as any,
        notes: data.notes,
        jobId: data.jobId,
        status: AssetStatus.DRAFT,
        createdById: userId,
      },
    }),
    prisma.asset.update({
      where: { id: assetId },
      data: { currentVersion: nextVersion, status: AssetStatus.DRAFT },
    }),
  ]);

  await prisma.activityLog.create({
    data: {
      action: 'created version',
      entityType: 'asset',
      entityId: assetId,
      detail: `v${nextVersion}`,
      userId,
      projectId: asset.projectId,
      assetId,
    },
  });

  return version;
}

// ─── Reviews ─────────────────────────────────

export async function approveVersion(versionId: string, reviewerId: string, comment?: string) {
  return createReview(versionId, reviewerId, ReviewDecision.APPROVED, comment);
}

export async function rejectVersion(versionId: string, reviewerId: string, comment: string) {
  if (!comment?.trim()) throw Errors.BadRequest('A comment is required when rejecting an asset version');
  return createReview(versionId, reviewerId, ReviewDecision.REJECTED, comment);
}

export async function requestRevision(versionId: string, reviewerId: string, comment: string) {
  if (!comment?.trim()) throw Errors.BadRequest('A comment is required when requesting revision');
  return createReview(versionId, reviewerId, ReviewDecision.REVISION_REQUESTED, comment);
}

async function createReview(
  versionId: string,
  reviewerId: string,
  decision: ReviewDecision,
  comment?: string,
) {
  const version = await prisma.assetVersion.findUnique({
    where: { id: versionId },
    include: { asset: { select: { id: true, projectId: true, name: true } } },
  });
  if (!version) throw Errors.NotFound('Asset version not found');

  const statusMap: Record<ReviewDecision, AssetStatus> = {
    [ReviewDecision.APPROVED]:           AssetStatus.APPROVED,
    [ReviewDecision.REJECTED]:           AssetStatus.REJECTED,
    [ReviewDecision.REVISION_REQUESTED]: AssetStatus.REVISION_REQUESTED,
  };
  const newStatus = statusMap[decision];

  const actionMap: Record<ReviewDecision, string> = {
    [ReviewDecision.APPROVED]:           'approved',
    [ReviewDecision.REJECTED]:           'rejected',
    [ReviewDecision.REVISION_REQUESTED]: 'requested revision on',
  };

  const [review] = await prisma.$transaction([
    prisma.review.create({
      data: { versionId, reviewerId, decision, comment },
      include: { reviewer: { select: { id: true, name: true, avatarUrl: true } } },
    }),
    prisma.assetVersion.update({ where: { id: versionId }, data: { status: newStatus } }),
    prisma.asset.update({ where: { id: version.assetId }, data: { status: newStatus } }),
  ]);

  await prisma.activityLog.create({
    data: {
      action: actionMap[decision],
      entityType: 'asset',
      entityId: version.assetId,
      detail: comment?.slice(0, 200),
      userId: reviewerId,
      projectId: version.asset.projectId,
      assetId: version.assetId,
    },
  });

  return review;
}

// ─── Comments ─────────────────────────────────

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

export async function getVersion(versionId: string) {
  const version = await prisma.assetVersion.findUnique({
    where: { id: versionId },
    include: {
      reviews: {
        include: { reviewer: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });
  if (!version) throw Errors.NotFound('Asset version not found');
  return version;
}

export async function getReviews(assetId: string) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw Errors.NotFound('Asset not found');

  return prisma.review.findMany({
    where: { version: { assetId } },
    orderBy: { createdAt: 'desc' },
    include: {
      reviewer: { select: { id: true, name: true, avatarUrl: true } },
      version: { select: { id: true, versionNumber: true } },
    },
  });
}

export async function getComments(assetId: string) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw Errors.NotFound('Asset not found');

  return prisma.comment.findMany({
    where: { assetId },
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });
}
