/**
 * tools.service.ts
 *
 * AI Tool Registry — CRUD for the AITool table.
 * Pluggable adapters for each provider live in adapters/.
 * To add a new provider: create adapters/<provider>.ts and register it below.
 */

import prisma from '../../config/database';
import { Errors } from '../../utils/errors';
import { env } from '../../config/env';
import { ToolCategory } from '@prisma/client';

export async function listTools(activeOnly = true) {
  return prisma.aITool.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getTool(id: string) {
  const tool = await prisma.aITool.findUnique({ where: { id } });
  if (!tool) throw Errors.NotFound('AI Tool not found');
  return tool;
}

export async function getToolBySlug(slug: string) {
  const tool = await prisma.aITool.findUnique({ where: { slug } });
  if (!tool) throw Errors.NotFound(`AI Tool "${slug}" not found`);
  return tool;
}

export async function createTool(data: {
  name: string;
  slug: string;
  description?: string;
  category?: ToolCategory;
  provider?: string;
  modelId?: string;
  config?: Record<string, unknown>;
}) {
  const existing = await prisma.aITool.findUnique({ where: { slug: data.slug } });
  if (existing) throw Errors.Conflict(`A tool with slug "${data.slug}" already exists`);
  return prisma.aITool.create({ data: { ...data, config: data.config as any } });
}

export async function updateTool(id: string, data: Partial<{
  name: string;
  description: string;
  category: ToolCategory;
  modelId: string;
  isActive: boolean;
  config: Record<string, unknown>;
}>) {
  await getTool(id);
  return prisma.aITool.update({ where: { id }, data: { ...data, config: data.config as any } });
}

export async function deleteTool(id: string) {
  await getTool(id);
  await prisma.aITool.delete({ where: { id } });
}

// ─── Provider Health Check ───────────────────
// Returns a map of provider → api key configured status.
// Real health ping can be added per provider.

export async function getProviderStatus() {
  return {
    openai: { configured: !!env.OPENAI_API_KEY, provider: 'openai' },
    stability: { configured: !!env.STABILITY_API_KEY, provider: 'stability' },
    replicate: { configured: !!env.REPLICATE_API_TOKEN, provider: 'replicate' },
  };
}

// ─── Direct Tool Invocation (for preview/test) ────────────────────
// For lightweight, synchronous tool calls (not queued).
// Heavy/async jobs should use the job queue instead.

export async function invokeToolDirect(
  slug: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const tool = await getToolBySlug(slug);
  if (!tool.isActive) throw Errors.BadRequest('This tool is currently inactive');

  // Route to the appropriate adapter
  switch (tool.provider) {
    case 'openai':
      return invokeOpenAI(tool, params);
    case 'stability':
      return invokeStability(tool, params);
    case 'replicate':
      return invokeReplicate(tool, params);
    default:
      throw Errors.BadRequest(`No adapter for provider "${tool.provider}"`);
  }
}

// ─── Adapters (stub implementations) ─────────
// Replace each stub with the real SDK call in production.

async function invokeOpenAI(
  tool: { name: string; modelId: string | null },
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!env.OPENAI_API_KEY) throw Errors.BadRequest('OpenAI API key not configured');
  // TODO: const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  // const res = await openai.images.generate({ model: tool.modelId ?? 'dall-e-3', prompt: params.prompt as string, ... });
  return { provider: 'openai', model: tool.modelId, params, stub: true };
}

async function invokeStability(
  tool: { name: string; modelId: string | null },
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!env.STABILITY_API_KEY) throw Errors.BadRequest('Stability API key not configured');
  // TODO: integrate @stability-ai/api
  return { provider: 'stability', model: tool.modelId, params, stub: true };
}

async function invokeReplicate(
  tool: { name: string; modelId: string | null },
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!env.REPLICATE_API_TOKEN) throw Errors.BadRequest('Replicate API token not configured');
  // TODO: import Replicate from 'replicate'; const replicate = new Replicate({ auth: env.REPLICATE_API_TOKEN });
  return { provider: 'replicate', model: tool.modelId, params, stub: true };
}
