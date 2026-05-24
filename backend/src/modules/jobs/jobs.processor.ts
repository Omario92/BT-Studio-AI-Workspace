/**
 * jobs.processor.ts
 *
 * Core AI job processing logic. Each JobType maps to a handler that
 * calls the appropriate AI tool provider and stores the result assets in Storage.
 */

import prisma from '../../config/database';
import { JobType, AssetStatus, Prisma } from '@prisma/client';
import { Errors } from '../../utils/errors';
import logger from '../../utils/logger';
import { getAIProvider } from '../ai-tools/providers/provider.factory';
import { storageService } from '../storage/storage.service';
import { createAsset, createVersion } from '../assets/assets.service';

type ProgressCallback = (pct: number) => void;

export async function processAIJob(
  jobId: string,
  onProgress: ProgressCallback,
): Promise<Record<string, unknown>> {
  const job = await prisma.aIJob.findUnique({
    where: { id: jobId },
    include: { tool: true },
  });
  if (!job) throw Errors.NotFound('AIJob not found');

  const params = job.params as Record<string, unknown>;
  
  // Resolve tool slug and provider
  const tool = job.tool;
  if (!tool) {
    throw Errors.BadRequest('No AI Tool associated with this job');
  }

  // Get active provider instance
  const provider = getAIProvider(tool.provider || 'mock');

  logger.info({ jobId, toolSlug: tool.slug, provider: tool.provider }, 'Running production AI Job pipeline');
  onProgress(10);

  // 1. Invoke AI Provider
  let result = await provider.invoke({
    toolSlug: tool.slug,
    params,
    jobId: job.id
  });
  onProgress(40);

  // 2. Poll if Pending
  let pollAttempts = 0;
  const maxAttempts = 120; // 4 minutes max
  while (result.status === 'PENDING' && provider.poll && pollAttempts < maxAttempts) {
    logger.debug({ jobId, providerJobId: result.providerJobId, attempt: pollAttempts }, 'Polling provider status...');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    result = await provider.poll(result.providerJobId!, tool.slug);
    pollAttempts++;
    onProgress(Math.min(40 + Math.round((pollAttempts / 10) * 10), 85));
  }

  if (result.status !== 'COMPLETED' || !result.fileUrl) {
    throw new Error(result.errorMsg || 'AI Provider failed to complete or returned no outputs');
  }

  onProgress(90);

  // 3. Resolve Asset and Version numbers
  const assetId = (params.assetId as string) || `ast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  let existingAsset = null;
  if (params.assetId) {
    existingAsset = await prisma.asset.findUnique({ where: { id: params.assetId as string } });
  }

  const nextVersion = existingAsset ? (existingAsset.currentVersion + 1) : 1;
  const ext = result.fileUrl.split('?')[0].split('.').pop() || 'png';
  const filename = `${tool.slug.replace(/-/g, '_')}_${Date.now()}.${ext}`;
  const mimeType = ext === 'mp4' ? 'video/mp4' : ext === 'wav' ? 'audio/wav' : ext === 'mp3' ? 'audio/mpeg' : 'image/png';
  const fileKey = `projects/${job.projectId}/assets/${assetId}/versions/v${nextVersion}/${filename}`;

  // 4. Download output and store in primary StorageProvider
  logger.info({ providerUrl: result.fileUrl, fileKey }, 'Copying provider outputs to primary Storage');
  const storedObject = await storageService.copyFromUrl(result.fileUrl, fileKey, mimeType);

  let finalAssetId = '';
  let finalAssetVersionId = '';

  // 5. Persist inside Database
  if (existingAsset) {
    logger.info({ assetId: existingAsset.id, version: nextVersion }, 'Appending new version to existing asset');
    const version = await createVersion(existingAsset.id, job.userId, {
      fileUrl: storedObject.fileUrl,
      mimeType: storedObject.mimeType,
      fileSizeBytes: storedObject.fileSizeBytes,
      jobId: job.id,
      notes: (params.notes as string) || `Generated via ${tool.name}`,
      params: params,
    });
    finalAssetId = existingAsset.id;
    finalAssetVersionId = version.id;
  } else {
    logger.info({ assetId, version: 1 }, 'Creating brand new Asset and Version v1');
    // Force set the generated asset id to avoid default random uuid
    const asset = await prisma.asset.create({
      data: {
        id: assetId,
        name: filename,
        fileUrl: storedObject.fileUrl,
        mimeType: storedObject.mimeType,
        fileSizeBytes: storedObject.fileSizeBytes,
        status: AssetStatus.DRAFT,
        currentVersion: 1,
        projectId: job.projectId,
        creatorId: job.userId,
        jobId: job.id,
        metadata: params as any,
      },
    });

    const version = await prisma.assetVersion.create({
      data: {
        assetId: asset.id,
        versionNumber: 1,
        fileUrl: storedObject.fileUrl,
        mimeType: storedObject.mimeType,
        fileSizeBytes: storedObject.fileSizeBytes,
        status: AssetStatus.DRAFT,
        jobId: job.id,
        createdById: job.userId,
      },
    });
    finalAssetId = asset.id;
    finalAssetVersionId = version.id;
  }

  // 6. Log precise AI Action activity log
  let action = 'generated';
  if (job.type === JobType.IMAGE_UPSCALE) action = 'upscaled';
  else if (job.type === JobType.IMAGE_EDIT) action = 'edited';
  else if (job.type === JobType.REMOVE_BACKGROUND) action = 'removed background';
  else if (job.type === JobType.RELIGHT) action = 'relit';
  else if (job.type === JobType.VIDEO_GENERATION) action = 'generated video';
  else if (job.type === JobType.VOICE_GENERATION) action = 'generated voice';

  await prisma.activityLog.create({
    data: {
      action,
      entityType: 'asset',
      entityId: finalAssetId,
      userId: job.userId,
      projectId: job.projectId,
      assetId: finalAssetId,
      jobId: job.id,
    },
  });

  onProgress(100);

  return {
    assetId: finalAssetId,
    assetVersionId: finalAssetVersionId,
    fileUrl: storedObject.fileUrl,
    fileKey: storedObject.fileKey,
    provider: tool.provider || 'mock',
    toolSlug: tool.slug,
  };
}
