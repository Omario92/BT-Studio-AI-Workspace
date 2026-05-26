/**
 * Replicate AI Provider
 * ─────────────────────
 * Adapter that runs models on https://replicate.com via the REST API.
 *
 * - Reads `REPLICATE_API_TOKEN` from env.
 * - Reads per-tool model + default inputs from the tool's `AITool.config` field
 *   in Postgres (so we can change models without redeploying).
 * - Returns PENDING immediately; `processAIJob` then polls via `poll()`.
 *
 * Per-tool config shape (stored in AITool.config jsonb):
 *   {
 *     "model":   "nightmareai/real-esrgan",
 *     "version": "f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
 *     "inputMap": {
 *        "image": "fileUrl",       // mapping: replicate input key -> job param key
 *        "scale": "scale",
 *        "face_enhance": "faceEnhance"
 *     },
 *     "defaults": { "scale": 4, "face_enhance": false }
 *   }
 */

import axios from 'axios';
import prisma from '../../../config/database';
import { env } from '../../../config/env';
import logger from '../../../utils/logger';
import { AIProvider, AIProviderInput, AIProviderResult } from './provider.types';

const REPLICATE_API = 'https://api.replicate.com/v1';

interface ToolReplicateConfig {
  model?: string;
  version: string;
  inputMap?: Record<string, string>;
  defaults?: Record<string, unknown>;
}

export class ReplicateProvider implements AIProvider {
  private get token(): string {
    const t = env.REPLICATE_API_TOKEN;
    if (!t) throw new Error('REPLICATE_API_TOKEN not configured');
    return t;
  }

  private headers() {
    return {
      Authorization: `Token ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Build the `input` object the Replicate model expects, by mapping
   * job params through the tool's inputMap and merging the defaults.
   */
  private buildInput(cfg: ToolReplicateConfig, params: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...(cfg.defaults ?? {}) };

    if (cfg.inputMap) {
      for (const [replicateKey, jobParamKey] of Object.entries(cfg.inputMap)) {
        const v = params[jobParamKey];
        if (v !== undefined && v !== null && v !== '') out[replicateKey] = v;
      }
    } else {
      // Fallback: pass through fileUrl as 'image' which most image models accept
      if (params.fileUrl) out.image = params.fileUrl;
    }

    return out;
  }

  async invoke(input: AIProviderInput): Promise<AIProviderResult> {
    // Resolve the tool config from DB (so model versions can be swapped without redeploy)
    const tool = await prisma.aITool.findUnique({ where: { slug: input.toolSlug } });
    if (!tool?.config) {
      return { status: 'FAILED', errorMsg: `Tool "${input.toolSlug}" has no Replicate config` };
    }
    const cfg = tool.config as unknown as ToolReplicateConfig;
    if (!cfg.version) {
      return { status: 'FAILED', errorMsg: `Tool "${input.toolSlug}" config missing "version"` };
    }

    const body = {
      version: cfg.version,
      input: this.buildInput(cfg, input.params),
    };

    logger.info({ toolSlug: input.toolSlug, jobId: input.jobId, model: cfg.model }, '[Replicate] creating prediction');

    try {
      const { data } = await axios.post(`${REPLICATE_API}/predictions`, body, {
        headers: this.headers(),
        timeout: 30000,
      });
      return this.normalize(data);
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? err.message ?? String(err);
      logger.error({ jobId: input.jobId, msg }, '[Replicate] invoke failed');
      return { status: 'FAILED', errorMsg: `Replicate invoke failed: ${msg}` };
    }
  }

  async poll(providerJobId: string, _toolSlug: string): Promise<AIProviderResult> {
    try {
      const { data } = await axios.get(`${REPLICATE_API}/predictions/${providerJobId}`, {
        headers: this.headers(),
        timeout: 15000,
      });
      return this.normalize(data);
    } catch (err: any) {
      const msg = err.response?.data?.detail ?? err.message ?? String(err);
      return { status: 'FAILED', errorMsg: `Replicate poll failed: ${msg}`, providerJobId };
    }
  }

  /** Translate Replicate's API response into our AIProviderResult shape. */
  private normalize(data: any): AIProviderResult {
    const providerJobId = data.id;
    const status = data.status as string; // 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'

    if (status === 'succeeded') {
      // `output` may be a string (single URL), array of URLs, or an object — handle the common cases
      let fileUrl: string | undefined;
      if (typeof data.output === 'string') fileUrl = data.output;
      else if (Array.isArray(data.output) && typeof data.output[0] === 'string') fileUrl = data.output[0];
      else if (data.output && typeof data.output === 'object' && typeof data.output.image === 'string') fileUrl = data.output.image;

      if (!fileUrl) {
        return { status: 'FAILED', errorMsg: 'Replicate succeeded but no output URL found', providerJobId };
      }
      return { status: 'COMPLETED', fileUrl, providerJobId, outputData: data.output };
    }

    if (status === 'failed' || status === 'canceled') {
      return { status: 'FAILED', errorMsg: data.error || `Replicate prediction ${status}`, providerJobId };
    }

    // starting / processing → still pending
    return { status: 'PENDING', providerJobId };
  }
}
