import { env } from '../../../config/env';
import logger from '../../../utils/logger';
import { AIProvider, AIProviderInput, AIProviderResult } from './provider.types';
import { MockProvider } from './mock.provider';
import { RunPodProvider } from './runpod.provider';
import { ComfyUIProvider } from './comfyui.provider';
import { DispatcherProvider } from './dispatcher.provider';

const mockProvider = new MockProvider();
const runpodProvider = new RunPodProvider();
const comfyuiProvider = new ComfyUIProvider();
const dispatcherProvider = new DispatcherProvider();

const REGISTRY: Record<string, AIProvider> = {
  mock: mockProvider,
  runpod: runpodProvider,
  comfyui: comfyuiProvider,
  dispatcher: dispatcherProvider,
};

/**
 * Resolve a provider instance by name. Returns mock if name is unknown.
 * NOTE: this is a direct lookup — for IMAGE_UPSCALE we prefer
 * `getAIProviderForUpscale()` below which adds graceful fallback.
 */
export function getAIProvider(providerName?: string): AIProvider {
  const name = (providerName || 'mock').toLowerCase();
  return REGISTRY[name] || mockProvider;
}

/**
 * Build the resolved fallback chain for IMAGE_UPSCALE jobs.
 *  - Honours the tool's configured `provider` field first.
 *  - Then falls back through AI_PROVIDER_PRIORITY (default: dispatcher,comfyui,mock).
 *  - Optionally honours params.providerPreference to override per-job.
 *  - Mock is always appended at the very end as a safety net.
 */
export function resolveUpscaleProviderChain(opts: {
  toolProvider?: string | null;
  paramsPreference?: unknown;
}): { name: string; provider: AIProvider }[] {
  const seen = new Set<string>();
  const out: { name: string; provider: AIProvider }[] = [];

  const push = (n?: string | null) => {
    if (!n) return;
    const key = n.toLowerCase();
    if (seen.has(key)) return;
    const p = REGISTRY[key];
    if (!p) return;
    seen.add(key);
    out.push({ name: key, provider: p });
  };

  if (opts.toolProvider) push(opts.toolProvider);

  if (Array.isArray(opts.paramsPreference)) {
    for (const n of opts.paramsPreference) if (typeof n === 'string') push(n);
  }

  for (const n of (env.AI_PROVIDER_PRIORITY || '').split(',').map(s => s.trim()).filter(Boolean)) {
    push(n);
  }

  push('mock'); // safety net

  return out;
}

/**
 * Invoke the upscale chain. If a provider returns a "not configured" failure
 * (config-missing), fall through to the next. A real runtime failure surfaces
 * immediately — we do NOT silently hide real errors.
 */
export async function invokeUpscaleWithFallback(
  input: AIProviderInput,
  chain: { name: string; provider: AIProvider }[],
): Promise<{ result: AIProviderResult; provider: AIProvider; providerName: string }> {
  let lastResult: AIProviderResult | null = null;
  let lastName = '';
  for (const { name, provider } of chain) {
    if (typeof (provider as any).isConfigured === 'function' && !(provider as any).isConfigured()) {
      logger.info({ provider: name }, 'Skipping unconfigured provider; trying next in chain');
      continue;
    }
    logger.info({ provider: name }, 'Upscale chain: invoking provider');
    const result = await provider.invoke(input);
    lastResult = result;
    lastName = name;

    const notConfigured = result.status === 'FAILED' && (
      result.errorMsg === 'DISPATCHER_NOT_CONFIGURED' ||
      (result.outputData as any)?.notConfigured === true
    );
    if (notConfigured) {
      logger.warn({ provider: name }, 'Provider reported notConfigured — falling back to next');
      continue;
    }
    return { result, provider, providerName: name };
  }
  // Should never get here because mock is always in the chain
  return {
    result: lastResult ?? { status: 'FAILED', errorMsg: 'No AI provider available' },
    provider: mockProvider,
    providerName: lastName || 'mock',
  };
}
