/**
 * jobs.processor.ts
 *
 * Core AI job processing logic. Each JobType maps to a handler that
 * calls the appropriate AI tool service and stores the result assets.
 *
 * Add new job types here — the queue worker calls processAIJob() for all.
 * Replace stub implementations with real provider SDK calls in production.
 */

import prisma from '../../config/database';
import { JobType, AssetStatus } from '@prisma/client';
import { Errors } from '../../utils/errors';
import logger from '../../utils/logger';

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

  switch (job.type) {
    case JobType.IMAGE_GENERATION:
      return handleImageGeneration(job, params, onProgress);
    case JobType.IMAGE_UPSCALE:
      return handleUpscale(job, params, onProgress);
    case JobType.IMAGE_EDIT:
      return handleImageEdit(job, params, onProgress);
    case JobType.VARIATION:
      return handleVariation(job, params, onProgress);
    case JobType.REMOVE_BACKGROUND:
      return handleRemoveBackground(job, params, onProgress);
    case JobType.RELIGHT:
      return handleRelight(job, params, onProgress);
    case JobType.VIDEO_GENERATION:
      return handleVideoGeneration(job, params, onProgress);
    case JobType.VOICE_GENERATION:
      return handleVoiceGeneration(job, params, onProgress);
    case JobType.BATCH_GENERATION:
      return handleBatchGeneration(job, params, onProgress);
    case JobType.CUSTOM:
      return handleCustom(job, params, onProgress);
    default:
      throw new Error(`Unsupported job type: ${job.type}`);
  }
}

// ─── Shared asset creation helper ────────────

async function persistAsset(job: any, name: string, fileUrl: string, mimeType: string, params: Record<string, unknown>) {
  const asset = await prisma.asset.create({
    data: {
      name,
      fileUrl,
      mimeType,
      status: AssetStatus.DRAFT,
      currentVersion: 1,
      projectId: job.projectId,
      creatorId: job.userId,
      jobId: job.id,
      metadata: params as any,
    },
  });

  // Create initial version record
  await prisma.assetVersion.create({
    data: {
      assetId: asset.id,
      versionNumber: 1,
      fileUrl,
      mimeType,
      status: AssetStatus.DRAFT,
      jobId: job.id,
      createdById: job.userId,
    },
  });

  await prisma.activityLog.create({
    data: {
      action: 'generated',
      entityType: 'asset',
      entityId: asset.id,
      userId: job.userId,
      projectId: job.projectId,
      assetId: asset.id,
      jobId: job.id,
    },
  });

  return asset;
}

// ─── Handlers ────────────────────────────────

async function handleImageGeneration(job: any, params: Record<string, unknown>, onProgress: ProgressCallback) {
  logger.debug({ jobId: job.id, params }, 'Starting image generation');
  onProgress(10);
  // TODO: const res = await openai.images.generate({ model: 'dall-e-3', prompt: params.prompt as string });
  const mockUrl = `https://cdn.btstudio.ai/generated/${job.id}/output.png`;
  onProgress(80);
  const asset = await persistAsset(job, `Generated_${Date.now()}.png`, mockUrl, 'image/png', params);
  onProgress(100);
  return { assetId: asset.id, fileUrl: mockUrl };
}

async function handleUpscale(job: any, params: Record<string, unknown>, onProgress: ProgressCallback) {
  onProgress(20);
  // TODO: call Replicate upscaler model
  const mockUrl = `https://cdn.btstudio.ai/upscale/${job.id}/output.png`;
  onProgress(90);
  const asset = await persistAsset(job, `Upscaled_${Date.now()}.png`, mockUrl, 'image/png', params);
  onProgress(100);
  return { assetId: asset.id, fileUrl: mockUrl };
}

async function handleImageEdit(job: any, params: Record<string, unknown>, onProgress: ProgressCallback) {
  onProgress(20);
  const mockUrl = `https://cdn.btstudio.ai/edit/${job.id}/output.png`;
  onProgress(85);
  const asset = await persistAsset(job, `Edited_${Date.now()}.png`, mockUrl, 'image/png', params);
  onProgress(100);
  return { assetId: asset.id, fileUrl: mockUrl };
}

async function handleVariation(job: any, params: Record<string, unknown>, onProgress: ProgressCallback) {
  onProgress(15);
  const mockUrl = `https://cdn.btstudio.ai/variation/${job.id}/output.png`;
  onProgress(85);
  const asset = await persistAsset(job, `Variation_${Date.now()}.png`, mockUrl, 'image/png', params);
  onProgress(100);
  return { assetId: asset.id, fileUrl: mockUrl };
}

async function handleRemoveBackground(job: any, params: Record<string, unknown>, onProgress: ProgressCallback) {
  onProgress(30);
  const mockUrl = `https://cdn.btstudio.ai/remove-bg/${job.id}/output.png`;
  onProgress(90);
  const asset = await persistAsset(job, `NoBG_${Date.now()}.png`, mockUrl, 'image/png', params);
  onProgress(100);
  return { assetId: asset.id, fileUrl: mockUrl };
}

async function handleRelight(job: any, params: Record<string, unknown>, onProgress: ProgressCallback) {
  onProgress(25);
  const mockUrl = `https://cdn.btstudio.ai/relight/${job.id}/output.png`;
  onProgress(90);
  const asset = await persistAsset(job, `Relit_${Date.now()}.png`, mockUrl, 'image/png', params);
  onProgress(100);
  return { assetId: asset.id, fileUrl: mockUrl };
}

async function handleVideoGeneration(job: any, params: Record<string, unknown>, onProgress: ProgressCallback) {
  onProgress(10);
  // TODO: call video generation provider (e.g. Runway, Kling)
  const mockUrl = `https://cdn.btstudio.ai/video/${job.id}/output.mp4`;
  onProgress(90);
  const asset = await persistAsset(job, `VideoGen_${Date.now()}.mp4`, mockUrl, 'video/mp4', params);
  onProgress(100);
  return { assetId: asset.id, fileUrl: mockUrl };
}

async function handleVoiceGeneration(job: any, params: Record<string, unknown>, onProgress: ProgressCallback) {
  onProgress(20);
  // TODO: call ElevenLabs / custom TTS
  const mockUrl = `https://cdn.btstudio.ai/voice/${job.id}/output.wav`;
  onProgress(90);
  const asset = await persistAsset(job, `Voice_${Date.now()}.wav`, mockUrl, 'audio/wav', params);
  onProgress(100);
  return { assetId: asset.id, fileUrl: mockUrl };
}

async function handleBatchGeneration(job: any, params: Record<string, unknown>, onProgress: ProgressCallback) {
  const frameCount = (params.frameCount as number) ?? 10;
  const assets: { assetId: string; fileUrl: string }[] = [];

  for (let i = 0; i < frameCount; i++) {
    const pct = Math.round(((i + 1) / frameCount) * 90);
    onProgress(pct);
    const mockUrl = `https://cdn.btstudio.ai/batch/${job.id}/frame_${i.toString().padStart(4, '0')}.png`;
    const asset = await persistAsset(
      job,
      `Frame_${i.toString().padStart(4, '0')}.png`,
      mockUrl,
      'image/png',
      { ...params, frameIndex: i },
    );
    assets.push({ assetId: asset.id, fileUrl: mockUrl });
  }
  onProgress(100);
  return { frameCount, assets };
}

async function handleCustom(job: any, params: Record<string, unknown>, onProgress: ProgressCallback) {
  onProgress(50);
  logger.info({ jobId: job.id }, 'Custom job — no built-in handler');
  onProgress(100);
  return { info: 'Custom job processed', params };
}
