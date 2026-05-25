import prisma from '../../config/database';
import { Errors } from '../../utils/errors';
import { AssetStatus, ReviewDecision } from '@prisma/client';
import { storageService } from '../storage/storage.service';
import { createJob, createBatch } from '../jobs/jobs.service';
import { extractAssetStorageKeys } from './asset-storage-keys';

/** Delete a list of storage keys, classifying NotFound errors as success. */
async function deleteStorageObjects(fileKeys: string[]): Promise<{
  deleted: string[];
  failed: { fileKey: string; error: string }[];
}> {
  if (!fileKeys || fileKeys.length === 0) return { deleted: [], failed: [] };

  // Prefer bulk delete when the provider supports it
  if (typeof (storageService as any).deleteObjects === 'function') {
    const res = await (storageService as any).deleteObjects(fileKeys);
    // Treat "not found" errors as already-gone
    const benign = (e: { error: string }) => /not\s*found|nosuchkey|404/i.test(e.error);
    return {
      deleted: [...res.deleted, ...res.failed.filter(benign).map((e: { fileKey: string }) => e.fileKey)],
      failed: res.failed.filter((e: { error: string }) => !benign(e)),
    };
  }

  const deleted: string[] = [];
  const failed: { fileKey: string; error: string }[] = [];
  for (const key of fileKeys) {
    try {
      await storageService.deleteObject(key);
      deleted.push(key);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (/not\s*found|nosuchkey|404/i.test(msg)) {
        deleted.push(key); // benign — already gone
      } else {
        failed.push({ fileKey: key, error: msg });
      }
    }
  }
  return { deleted, failed };
}


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

/**
 * Delete an asset.
 *
 * Flow:
 *  1. Load asset + versions so we can collect every storage key.
 *  2. Permission check (creator OR project producer/art-director/admin).
 *  3. Delete R2/S3 objects FIRST. If any non-benign storage failure occurs:
 *       - if `force` is false → throw, keep DB row, return failedFileKeys
 *       - if `force` is true  → continue to DB delete (orphans are accepted)
 *  4. Delete DB asset (cascades to versions, reviews, comments).
 *  5. Activity log + return summary.
 */
export async function deleteAsset(id: string, userId: string, opts: { force?: boolean } = {}) {
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      versions: true,
    },
  });
  if (!asset) throw Errors.NotFound('Asset not found');

  // Permission: creator OR admin OR project producer/art-director
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const isAdmin = user?.role === 'ADMIN';
  if (asset.creatorId !== userId && !isAdmin) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: asset.projectId, userId } },
    });
    const canDeleteAll = member && ['PRODUCER', 'ART_DIRECTOR', 'ADMIN'].includes(member.role);
    if (!canDeleteAll) throw Errors.Forbidden('Only the asset creator or a project lead can delete it');
  }

  // 1. Collect every owned storage key referenced by this asset/versions
  const fileKeys = extractAssetStorageKeys(asset);

  // 2. Delete object-store files
  const { deleted: deletedFileKeys, failed: failedFileKeys } = await deleteStorageObjects(fileKeys);

  // 3. Refuse to drop the DB row if storage cleanup failed (unless force)
  if (failedFileKeys.length > 0 && !opts.force) {
    throw Errors.Internal(
      `Asset DB delete blocked: storage cleanup failed for ${failedFileKeys.length} object(s). ` +
      `Pass force=true to delete the DB row anyway and leave the orphans. ` +
      `Failed keys: ${failedFileKeys.slice(0, 3).map(f => f.fileKey).join(', ')}${failedFileKeys.length > 3 ? '…' : ''}`
    );
  }

  // 4. Activity log BEFORE delete (so we have project context)
  await prisma.activityLog.create({
    data: {
      action: 'deleted',
      entityType: 'asset',
      entityId: id,
      detail: JSON.stringify({
        deletedFileKeys,
        failedFileKeys: failedFileKeys.map(f => f.fileKey),
        forced: !!opts.force,
      }).slice(0, 1000),
      userId,
      projectId: asset.projectId,
    },
  });

  // 5. DB delete (cascades versions/comments/reviews)
  await prisma.asset.delete({ where: { id } });

  return {
    deletedId: id,
    deletedFileKeys,
    failedFileKeys,
  };
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

// ─── Bulk Operations (v6.0) ───────────────────

export async function bulkDeleteAssets(assetIds: string[], userId: string, opts: { force?: boolean } = {}) {
  if (!assetIds || assetIds.length === 0) throw Errors.BadRequest('No assets specified');

  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } },
    include: { versions: true },
  });

  if (assets.length === 0) throw Errors.NotFound('No assets found');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const isAdmin = user?.role === 'ADMIN';

  // ─── Permission check ───────────────────────────
  for (const asset of assets) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: asset.projectId, userId } }
    });
    if (!member && !isAdmin) throw Errors.Forbidden(`Access denied to project for asset ${asset.name}`);

    const isOwner = asset.creatorId === userId;
    const canDeleteAll = member && ['PRODUCER', 'ART_DIRECTOR', 'ADMIN'].includes(member.role);
    if (!isOwner && !canDeleteAll && !isAdmin) {
      throw Errors.Forbidden(`Only the creator or project lead can delete asset ${asset.name}`);
    }
  }

  // ─── Per-asset storage delete + DB delete ───────
  const deletedIds: string[] = [];
  const allDeletedFileKeys: string[] = [];
  const failed: { assetId: string; reason: string; failedFileKeys: string[] }[] = [];

  for (const asset of assets) {
    const fileKeys = extractAssetStorageKeys(asset);
    const { deleted, failed: failedStorage } = await deleteStorageObjects(fileKeys);

    if (failedStorage.length > 0 && !opts.force) {
      failed.push({
        assetId: asset.id,
        reason: `storage cleanup failed for ${failedStorage.length} object(s)`,
        failedFileKeys: failedStorage.map(f => f.fileKey),
      });
      continue; // keep the DB row
    }

    try {
      await prisma.asset.delete({ where: { id: asset.id } });
      deletedIds.push(asset.id);
      allDeletedFileKeys.push(...deleted);

      await prisma.activityLog.create({
        data: {
          action: 'deleted',
          entityType: 'asset',
          entityId: asset.id,
          detail: JSON.stringify({
            deletedFileKeys: deleted,
            failedFileKeys: failedStorage.map(f => f.fileKey),
            forced: !!opts.force,
            bulk: true,
          }).slice(0, 1000),
          userId,
          projectId: asset.projectId,
        },
      });
    } catch (dbErr: any) {
      failed.push({
        assetId: asset.id,
        reason: `db delete failed: ${dbErr.message ?? String(dbErr)}`,
        failedFileKeys: [],
      });
    }
  }

  // Aggregate activity log
  if (deletedIds.length > 0) {
    await prisma.activityLog.create({
      data: {
        action: 'bulk deleted',
        entityType: 'asset',
        entityId: deletedIds[0],
        detail: `${deletedIds.length} assets, ${allDeletedFileKeys.length} files`,
        userId,
        projectId: assets[0].projectId,
      }
    });
  }

  return {
    deletedIds,
    deletedFileKeys: allDeletedFileKeys,
    failed,
  };
}

export async function bulkMoveAssets(assetIds: string[], targetFolderId: string, userId: string) {
  if (!assetIds || assetIds.length === 0) throw Errors.BadRequest('No assets specified');
  
  const targetFolder = await prisma.folder.findUnique({ where: { id: targetFolderId } });
  if (!targetFolder) throw Errors.NotFound('Target folder not found');

  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } }
  });
  if (assets.length === 0) throw Errors.NotFound('No assets found');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const isAdmin = user?.role === 'ADMIN';

  for (const asset of assets) {
    if (asset.projectId !== targetFolder.projectId) {
      throw Errors.BadRequest(`Asset ${asset.name} project mismatch with target folder`);
    }

    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: asset.projectId, userId } }
    });
    if (!member && !isAdmin) throw Errors.Forbidden(`Access denied to project for asset ${asset.name}`);
  }

  await prisma.asset.updateMany({
    where: { id: { in: assetIds } },
    data: { folderId: targetFolderId }
  });

  const firstAsset = assets[0];
  await prisma.activityLog.create({
    data: {
      action: 'bulk moved',
      entityType: 'asset',
      entityId: firstAsset.id,
      detail: `${assets.length} assets to folder ${targetFolder.name}`,
      userId,
      projectId: firstAsset.projectId,
    }
  });

  return prisma.asset.findMany({
    where: { id: { in: assetIds } },
    include: {
      creator: { select: { id: true, name: true, avatarUrl: true } },
      folder: { select: { id: true, name: true } },
      _count: { select: { comments: true, versions: true } },
    }
  });
}

export async function bulkCopyAssets(assetIds: string[], targetFolderId: string, userId: string) {
  if (!assetIds || assetIds.length === 0) throw Errors.BadRequest('No assets specified');

  const targetFolder = await prisma.folder.findUnique({ where: { id: targetFolderId } });
  if (!targetFolder) throw Errors.NotFound('Target folder not found');

  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } },
    include: {
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 1
      }
    }
  });
  if (assets.length === 0) throw Errors.NotFound('No assets found');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const isAdmin = user?.role === 'ADMIN';

  const copiedAssets = [];

  for (const asset of assets) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: targetFolder.projectId, userId } }
    });
    if (!member && !isAdmin) throw Errors.Forbidden(`Access denied to target project for copy`);

    const newAsset = await prisma.asset.create({
      data: {
        name: `Copy of ${asset.name}`,
        fileUrl: asset.fileUrl,
        mimeType: asset.mimeType,
        fileSizeBytes: asset.fileSizeBytes,
        status: AssetStatus.DRAFT,
        currentVersion: 1,
        projectId: targetFolder.projectId,
        folderId: targetFolderId,
        creatorId: userId,
        metadata: asset.metadata as any,
      }
    });

    const sourceVersion = asset.versions[0];
    await prisma.assetVersion.create({
      data: {
        assetId: newAsset.id,
        versionNumber: 1,
        fileUrl: sourceVersion?.fileUrl || asset.fileUrl,
        mimeType: sourceVersion?.mimeType || asset.mimeType,
        fileSizeBytes: sourceVersion?.fileSizeBytes || asset.fileSizeBytes,
        status: AssetStatus.DRAFT,
        createdById: userId,
        params: sourceVersion?.params as any,
      }
    });

    copiedAssets.push(newAsset);
  }

  const firstAsset = assets[0];
  await prisma.activityLog.create({
    data: {
      action: 'bulk copied',
      entityType: 'asset',
      entityId: firstAsset.id,
      detail: `${assets.length} assets`,
      userId,
      projectId: targetFolder.projectId,
    }
  });

  return copiedAssets;
}

export async function bulkDownloadAssets(assetIds: string[], userId: string) {
  if (!assetIds || assetIds.length === 0) throw Errors.BadRequest('No assets specified');

  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } }
  });
  if (assets.length === 0) throw Errors.NotFound('No assets found');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const isAdmin = user?.role === 'ADMIN';

  const files = [];

  for (const asset of assets) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: asset.projectId, userId } }
    });
    if (!member && !isAdmin) throw Errors.Forbidden(`Access denied to project for asset ${asset.name}`);

    const metadata: any = asset.metadata || {};
    const fileKey = metadata.fileKey || null;

    let url = asset.fileUrl || null;
    if (fileKey) {
      try {
        url = await storageService.createSignedDownload(fileKey);
      } catch (err) {
        console.warn(`[bulkDownloadAssets] Failed to create signed URL for key ${fileKey}:`, err);
      }
    }

    files.push({
      assetId: asset.id,
      name: asset.name,
      url,
    });
  }

  return { files };
}

export async function useAssetsWithAI(
  assetIds: string[],
  input: { projectId: string; toolId: string; jobType: any; mode: 'single' | 'batch' },
  userId: string
) {
  if (!assetIds || assetIds.length === 0) throw Errors.BadRequest('No assets specified');

  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } }
  });
  if (assets.length === 0) throw Errors.NotFound('No assets found');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const isAdmin = user?.role === 'ADMIN';

  for (const asset of assets) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: input.projectId, userId } }
    });
    if (!member && !isAdmin) throw Errors.Forbidden(`Access denied to project for asset ${asset.name}`);
  }

  // Tool-specific params (scale, faceEnhance, prompt, etc.) flow through `input.params`
  const extraParams = (input as any).params ?? {};

  // Resolve toolId — accept either a real CUID or a slug (e.g. "upscaler") for convenience
  let resolvedToolId = input.toolId;
  if (resolvedToolId) {
    const byId = await prisma.aITool.findUnique({ where: { id: resolvedToolId } });
    if (!byId) {
      const bySlug = await prisma.aITool.findUnique({ where: { slug: resolvedToolId } });
      if (!bySlug) throw Errors.NotFound(`AI Tool not found: "${resolvedToolId}"`);
      resolvedToolId = bySlug.id;
    }
  }

  if (input.mode === 'single' || assetIds.length === 1) {
    const asset = assets[0];
    const job = await createJob({
      name: `AI Action on ${asset.name}`,
      type: input.jobType,
      projectId: input.projectId,
      toolId: resolvedToolId,
      params: {
        // assetId is read by processAIJob to decide between "new version of source asset"
        // (when present) vs "create a brand-new asset" (when absent). Pass it so the
        // upscale/edit/bg-remove output lands as v2 on the source.
        assetId: asset.id,
        sourceAssetId: asset.id,
        fileKey: (asset.metadata as any)?.fileKey || null,
        fileUrl: asset.fileUrl,
        ...extraParams,
      }
    }, userId);
    return { mode: 'single', job };
  } else {
    const batchInputs = assets.map(asset => ({
      name: `AI Action on ${asset.name}`,
      params: {
        assetId: asset.id,
        sourceAssetId: asset.id,
        fileKey: (asset.metadata as any)?.fileKey || null,
        fileUrl: asset.fileUrl,
        ...extraParams,
      }
    }));

    const batch = await createBatch(input.projectId, resolvedToolId!, batchInputs, userId);
    return { mode: 'batch', batch };
  }
}

