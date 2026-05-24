/**
 * jobs.processor.ts
 *
 * Core AI job processing logic. Each JobType maps to a handler that
 * calls the appropriate AI tool service and stores the result assets.
 *
 * Add new job types here — the queue worker calls processAIJob() for all.
 */

import prisma from '../../config/database';
import { JobType, AssetStatus } from '@prisma/client';
import { Errors } from '../../utils/errors';
import logger from '../../utils/logger';

type ProgressCallback = (pct: number) => void;

export async function processAIJob(
  batchJobId: string,
  onProgress: ProgressCallback,
): Promise<Record<string, unknown>> {
  const job = await prisma.batchJob.findUnique({
    where: { id: batchJobId },
    include: { tool: true },
  });
  if (!job) throw Errors.NotFound('BatchJob not found');

  const params = job.params as Record<string, unknown>;

  switch (job.type) {
    case JobType.IMAGE_GENERATION:
      return handleImageGeneration(job, params, onProgress);

    case JobType.STYLE_TRANSFER:
      return handleStyleTransfer(job, params, onProgress);

    case JobType.BATCH_RENDER:
      return handleBatchRender(job, params, onProgress);

    case JobType.CHARACTER_CONSISTENCY:
      return handleCharacterConsistency(job, params, onProgress);

    case JobType.UPSCALE:
      return handleUpscale(job, params, onProgress);

    case JobType.CUSTOM:
      return handleCustom(job, params, onProgress);

    default:
      throw new Error(`Unsupported job type: ${job.type}`);
  }
}

// ─── Handlers ────────────────────────────────
// Each handler integrates with the AI provider via the AIToolService.
// Replace the stub calls with real API clients in production.

async function handleImageGeneration(
  job: any,
  params: Record<string, unknown>,
  onProgress: ProgressCallback,
) {
  logger.debug({ jobId: job.id, params }, 'Starting image generation');
  onProgress(10);

  // TODO: call the actual AI provider (e.g. OpenAI DALL-E 3)
  // const imageUrl = await openai.images.generate({ prompt: params.prompt, ... });
  const mockUrl = `https://cdn.btstudio.ai/generated/${job.id}/output.png`;

  onProgress(80);

  // Persist as a new Asset
  const asset = await prisma.asset.create({
    data: {
      name: `Generated_${Date.now()}.png`,
      fileUrl: mockUrl,
      mimeType: 'image/png',
      status: AssetStatus.WIP,
      projectId: job.projectId,
      creatorId: job.userId,
      jobId: job.id,
      metadata: params as any,
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

  onProgress(100);
  return { assetId: asset.id, fileUrl: mockUrl };
}

async function handleStyleTransfer(
  job: any,
  params: Record<string, unknown>,
  onProgress: ProgressCallback,
) {
  onProgress(20);
  // TODO: call Replicate or custom model
  const mockUrl = `https://cdn.btstudio.ai/style-transfer/${job.id}/output.png`;
  onProgress(90);
  const asset = await prisma.asset.create({
    data: {
      name: `StyledOutput_${Date.now()}.png`,
      fileUrl: mockUrl,
      mimeType: 'image/png',
      status: AssetStatus.WIP,
      projectId: job.projectId,
      creatorId: job.userId,
      jobId: job.id,
      metadata: params as any,
    },
  });
  onProgress(100);
  return { assetId: asset.id, fileUrl: mockUrl };
}

async function handleBatchRender(
  job: any,
  params: Record<string, unknown>,
  onProgress: ProgressCallback,
) {
  const frameCount = (params.frameCount as number) ?? 10;
  const assets: { assetId: string; fileUrl: string }[] = [];

  for (let i = 0; i < frameCount; i++) {
    const pct = Math.round(((i + 1) / frameCount) * 90);
    onProgress(pct);
    // TODO: render frame i via AI provider
    const mockUrl = `https://cdn.btstudio.ai/batch/${job.id}/frame_${i.toString().padStart(4, '0')}.png`;
    const asset = await prisma.asset.create({
      data: {
        name: `Frame_${i.toString().padStart(4, '0')}.png`,
        fileUrl: mockUrl,
        mimeType: 'image/png',
        status: AssetStatus.WIP,
        projectId: job.projectId,
        creatorId: job.userId,
        jobId: job.id,
        metadata: { ...params, frameIndex: i },
      },
    });
    assets.push({ assetId: asset.id, fileUrl: mockUrl });
  }
  onProgress(100);
  return { frameCount, assets };
}

async function handleCharacterConsistency(
  job: any,
  params: Record<string, unknown>,
  onProgress: ProgressCallback,
) {
  onProgress(30);
  const mockUrl = `https://cdn.btstudio.ai/char-consistency/${job.id}/output.png`;
  onProgress(90);
  const asset = await prisma.asset.create({
    data: {
      name: `CharConsistency_${Date.now()}.png`,
      fileUrl: mockUrl,
      mimeType: 'image/png',
      status: AssetStatus.WIP,
      projectId: job.projectId,
      creatorId: job.userId,
      jobId: job.id,
      metadata: params as any,
    },
  });
  onProgress(100);
  return { assetId: asset.id, fileUrl: mockUrl };
}

async function handleUpscale(
  job: any,
  params: Record<string, unknown>,
  onProgress: ProgressCallback,
) {
  onProgress(20);
  const mockUrl = `https://cdn.btstudio.ai/upscale/${job.id}/output.png`;
  onProgress(90);
  const asset = await prisma.asset.create({
    data: {
      name: `Upscaled_${Date.now()}.png`,
      fileUrl: mockUrl,
      mimeType: 'image/png',
      status: AssetStatus.WIP,
      projectId: job.projectId,
      creatorId: job.userId,
      jobId: job.id,
      metadata: params as any,
    },
  });
  onProgress(100);
  return { assetId: asset.id, fileUrl: mockUrl };
}

async function handleCustom(
  job: any,
  params: Record<string, unknown>,
  onProgress: ProgressCallback,
) {
  // Passthrough: the tool's external URL does the actual work
  onProgress(50);
  logger.info({ jobId: job.id }, 'Custom job — no built-in handler; mark as complete');
  onProgress(100);
  return { info: 'Custom job processed', params };
}
