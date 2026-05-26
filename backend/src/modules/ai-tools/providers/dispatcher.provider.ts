import axios from 'axios';
import fs from 'fs';
import { env } from '../../../config/env';
import { AIProvider, AIProviderInput, AIProviderResult } from './provider.types';
import logger from '../../../utils/logger';

/**
 * DispatcherProvider
 * ─────────────────────────────────────────────
 * Thin HTTP client for the external comfy-dispatcher service that auto-deploys
 * (or reuses) RunPod pods running ComfyUI on demand.
 *
 * Lifecycle:
 *   queued / starting_pod / waiting_comfyui / running  → PENDING
 *   done                                              → COMPLETED
 *   failed                                            → FAILED
 *
 * If DISPATCHER_BASE_URL is not configured, invoke() returns a special FAILED
 * result tagged with `notConfigured: true` so the provider factory can fall
 * back to the next provider in the priority chain (ComfyUI → Mock).
 */
export class DispatcherProvider implements AIProvider {
  private baseUrl: string;
  private apiKey: string;
  private callbackUrl: string;

  constructor() {
    this.baseUrl = (env.DISPATCHER_BASE_URL || '').replace(/\/$/, '');
    this.apiKey = env.DISPATCHER_API_KEY || '';
    this.callbackUrl = env.DISPATCHER_CALLBACK_URL || '';
  }

  isConfigured(): boolean {
    return !!this.baseUrl;
  }

  private authHeaders() {
    return this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {};
  }

  /** Resolve the workflow JSON to send to the dispatcher. */
  private loadUpscaleWorkflow(input: AIProviderInput): Record<string, unknown> | null {
    // 1. Inline JSON wins
    if (env.COMFYUI_UPSCALE_WORKFLOW_JSON) {
      try {
        return JSON.parse(env.COMFYUI_UPSCALE_WORKFLOW_JSON);
      } catch (err: any) {
        logger.warn({ err: err.message }, 'COMFYUI_UPSCALE_WORKFLOW_JSON is not valid JSON');
      }
    }
    // 2. Path on disk
    if (env.COMFYUI_UPSCALE_WORKFLOW_PATH) {
      try {
        const raw = fs.readFileSync(env.COMFYUI_UPSCALE_WORKFLOW_PATH, 'utf-8');
        return JSON.parse(raw);
      } catch (err: any) {
        logger.warn({ err: err.message, path: env.COMFYUI_UPSCALE_WORKFLOW_PATH }, 'Failed to read upscale workflow file');
      }
    }
    // 3. Fallback minimal placeholder so the dispatcher can still attempt — sourceFileUrl + scale are injected below
    return {
      __placeholder: true,
      __note: 'No COMFYUI_UPSCALE_WORKFLOW_* configured. Dispatcher should apply its default upscale workflow.',
      params: {
        scale: input.params.scale ?? 4,
        denoise: input.params.denoise ?? 45,
        faceEnhance: !!input.params.faceEnhance,
      },
    };
  }

  /** Best-effort: inject image url + scale into common node ids. Safe to noop. */
  private injectInputs(workflow: any, imageUrl: string, scale: number) {
    if (!workflow || typeof workflow !== 'object') return workflow;
    for (const nodeId of Object.keys(workflow)) {
      const node = workflow[nodeId];
      if (!node || typeof node !== 'object' || !node.inputs) continue;
      const cls = (node.class_type || '').toString();
      if (cls === 'LoadImage' && typeof node.inputs.image === 'string') {
        node.inputs.image = imageUrl;
      }
      if (/Upscale/i.test(cls)) {
        if (typeof node.inputs.scale_by === 'number') node.inputs.scale_by = scale;
        if (typeof node.inputs.upscale_method === 'string') { /* keep */ }
      }
    }
    return workflow;
  }

  async invoke(input: AIProviderInput): Promise<AIProviderResult> {
    if (!this.isConfigured()) {
      logger.warn('Dispatcher not configured (DISPATCHER_BASE_URL missing) — provider factory will fall back.');
      return {
        status: 'FAILED',
        errorMsg: 'DISPATCHER_NOT_CONFIGURED',
        outputData: { notConfigured: true, reason: 'DISPATCHER_BASE_URL missing' },
      };
    }

    const imageUrl = (input.params.sourceFileUrl as string) || (input.params.fileUrl as string) || '';
    if (!imageUrl) {
      return { status: 'FAILED', errorMsg: 'Dispatcher invoke: no source image URL on params (sourceFileUrl/fileUrl).' };
    }

    const scale = Number(input.params.scale ?? 4);
    const workflow = this.injectInputs(this.loadUpscaleWorkflow(input), imageUrl, scale);

    const body: Record<string, unknown> = {
      image_url: imageUrl,
      workflow,
      user_id: (input.params.userId as string) || input.jobId,
      priority: 'high',
      output_type: 'image',
      job_label: `bt_upscale_${input.jobId}`,
    };
    if (this.callbackUrl) body.callback_url = this.callbackUrl;

    logger.info({ jobId: input.jobId, baseUrl: this.baseUrl }, 'Submitting job to comfy-dispatcher');
    try {
      const res = await axios.post(`${this.baseUrl}/jobs`, body, {
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        timeout: 20000,
      });
      const data = res.data ?? {};
      const providerJobId = data.job_id || data.id;
      if (!providerJobId) {
        return { status: 'FAILED', errorMsg: 'Dispatcher returned no job_id', outputData: data };
      }
      return {
        status: 'PENDING',
        providerJobId,
        outputData: { dispatcher: true, raw: data },
      };
    } catch (err: any) {
      logger.error({ err: err.message, status: err.response?.status }, 'Dispatcher /jobs submission failed');
      return {
        status: 'FAILED',
        errorMsg: err.response?.data?.error ?? err.message ?? 'Dispatcher request failed',
      };
    }
  }

  async poll(providerJobId: string, _toolSlug: string): Promise<AIProviderResult> {
    if (!this.isConfigured()) {
      return { status: 'FAILED', errorMsg: 'Dispatcher not configured' };
    }
    try {
      const res = await axios.get(`${this.baseUrl}/jobs/${encodeURIComponent(providerJobId)}`, {
        headers: this.authHeaders(),
        timeout: 15000,
      });
      const data = res.data ?? {};
      const status = String(data.status || '').toLowerCase();

      // queued / starting_pod / waiting_comfyui / running → still pending
      if (['queued', 'starting_pod', 'waiting_comfyui', 'running'].includes(status)) {
        return { status: 'PENDING', providerJobId, outputData: data };
      }

      if (status === 'done') {
        const fileUrl = data.result_url || data.output_url || data.fileUrl || data.url;
        if (!fileUrl) {
          return {
            status: 'FAILED',
            errorMsg: 'Dispatcher returned status=done but no result_url/output_url/fileUrl/url',
            outputData: data,
          };
        }
        return { status: 'COMPLETED', fileUrl, outputData: data };
      }

      if (status === 'failed') {
        return {
          status: 'FAILED',
          errorMsg: data.error || data.message || 'Dispatcher job failed',
          outputData: data,
        };
      }

      // Unknown status — keep polling
      return { status: 'PENDING', providerJobId, outputData: data };
    } catch (err: any) {
      logger.warn({ providerJobId, err: err.message }, 'Dispatcher poll transient failure');
      // Transient — keep polling
      return { status: 'PENDING', providerJobId, errorMsg: err.message };
    }
  }
}
