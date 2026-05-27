import axios from 'axios';
import { env } from '../../../config/env';
import { AIProvider, AIProviderInput, AIProviderResult } from './provider.types';
import logger from '../../../utils/logger';
import { storageService } from '../../storage/storage.service';

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Pick a usable source image URL from job params. For IMAGE_UPSCALE the
 * Image Upscaler workbench (or assets.service hardening) populates these.
 * Falls back to a signed download URL when only a fileKey is known.
 */
export async function resolveSourceImageUrl(
  input: AIProviderInput,
): Promise<string> {
  const p = input.params as Record<string, any>;
  if (typeof p.sourceFileUrl === 'string' && p.sourceFileUrl) return p.sourceFileUrl;
  if (typeof p.fileUrl === 'string' && p.fileUrl) return p.fileUrl;
  if (typeof p.previewUrl === 'string' && p.previewUrl) return p.previewUrl;
  if (p.sourceAsset && typeof p.sourceAsset.fileUrl === 'string' && p.sourceAsset.fileUrl) {
    return p.sourceAsset.fileUrl;
  }
  const sourceFileKey = p.sourceFileKey || p.fileKey;
  if (typeof sourceFileKey === 'string' && sourceFileKey) {
    return await storageService.createSignedDownload(sourceFileKey);
  }
  throw new Error('IMAGE_UPSCALE requires sourceFileKey or sourceFileUrl');
}

function extensionFromContentType(ct: string): { ext: string; mime: string } {
  const v = (ct || '').toLowerCase().split(';')[0].trim();
  if (v === 'image/png') return { ext: 'png', mime: 'image/png' };
  if (v === 'image/jpeg' || v === 'image/jpg') return { ext: 'jpg', mime: 'image/jpeg' };
  if (v === 'image/webp') return { ext: 'webp', mime: 'image/webp' };
  if (v === 'image/gif') return { ext: 'gif', mime: 'image/gif' };
  return { ext: 'png', mime: 'image/png' };
}

export async function downloadImageAsBuffer(url: string): Promise<{
  buffer: Buffer; mimeType: string; extension: string;
}> {
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: env.COMFYUI_TIMEOUT_MS,
    maxContentLength: 200 * 1024 * 1024,
    maxBodyLength: 200 * 1024 * 1024,
  });
  const ct = (res.headers['content-type'] || res.headers['Content-Type'] || 'image/png') as string;
  const { ext, mime } = extensionFromContentType(ct);
  return { buffer: Buffer.from(res.data as ArrayBuffer), mimeType: mime, extension: ext };
}

/**
 * Upload an image buffer to ComfyUI's /upload/image and return the
 * server-side filename that LoadImage nodes should reference.
 *
 * Node 20+ has global FormData/Blob, so we don't need form-data.
 */
export async function uploadImageToComfyUI(
  baseUrl: string,
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  // Use undici-backed global Blob/FormData (Node 18+). ES2022 lib doesn't ship
  // their types so we reach for them via globalThis to keep tsc happy.
  const G = globalThis as any;
  const blob = new G.Blob([buffer], { type: mimeType });
  const form = new G.FormData();
  form.append('image', blob, filename);
  form.append('overwrite', 'true');

  const headers: Record<string, string> = {};
  if (env.COMFYUI_API_KEY) headers['Authorization'] = `Bearer ${env.COMFYUI_API_KEY}`;
  if (env.COMFYUI_AUTH_HEADER) {
    const [k, ...rest] = env.COMFYUI_AUTH_HEADER.split(':');
    if (k && rest.length) headers[k.trim()] = rest.join(':').trim();
  }

  const res = await axios.post(
    `${baseUrl.replace(/\/$/, '')}/upload/image`,
    form,
    { headers, timeout: env.COMFYUI_TIMEOUT_MS },
  );
  const data = res.data ?? {};
  const uploaded = data.name || data.filename;
  if (!uploaded) {
    throw new Error(`ComfyUI /upload/image returned no filename: ${JSON.stringify(data)}`);
  }
  return uploaded as string;
}

/** Mutate workflow to point its LoadImage node at the uploaded filename. */
export function injectLoadImage(
  workflow: any,
  uploadedFilename: string,
): any {
  const explicitId = env.COMFYUI_UPSCALE_LOAD_IMAGE_NODE_ID;
  if (explicitId && workflow[explicitId]?.inputs) {
    workflow[explicitId].inputs.image = uploadedFilename;
    return workflow;
  }
  for (const nodeId of Object.keys(workflow)) {
    const node = workflow[nodeId];
    if (node?.class_type === 'LoadImage' && node?.inputs && 'image' in node.inputs) {
      node.inputs.image = uploadedFilename;
      return workflow;
    }
  }
  throw new Error('No LoadImage node found in ComfyUI upscale workflow. Set COMFYUI_UPSCALE_LOAD_IMAGE_NODE_ID.');
}

/** Mutate workflow's SaveImage node to use a job-scoped filename prefix. */
export function injectSaveImagePrefix(workflow: any, input: AIProviderInput): any {
  const prefix = `${env.COMFYUI_UPSCALE_FILENAME_PREFIX || 'bt_upscale'}_${input.jobId}`;
  const explicitId = env.COMFYUI_UPSCALE_SAVE_IMAGE_NODE_ID;
  if (explicitId && workflow[explicitId]?.inputs) {
    workflow[explicitId].inputs.filename_prefix = prefix;
    return workflow;
  }
  for (const nodeId of Object.keys(workflow)) {
    const node = workflow[nodeId];
    if (node?.class_type === 'SaveImage' && node?.inputs) {
      node.inputs.filename_prefix = prefix;
    }
  }
  return workflow;
}

/** Best-effort injection of upscale knobs into any node that exposes them. */
function injectUpscaleParams(workflow: any, input: AIProviderInput): any {
  const p = input.params as Record<string, any>;
  const scale = typeof p.scale === 'number' ? p.scale : undefined;
  const denoise = typeof p.denoise === 'number' ? p.denoise / 100 : undefined; // 0-100 → 0-1
  for (const nodeId of Object.keys(workflow)) {
    const node = workflow[nodeId];
    if (!node || !node.inputs || !node.class_type) continue;
    const cls = String(node.class_type);
    if (/Upscale/i.test(cls)) {
      if (scale !== undefined && typeof node.inputs.scale_by === 'number') node.inputs.scale_by = scale;
    }
    if (cls === 'KSampler' && denoise !== undefined && typeof node.inputs.denoise === 'number') {
      node.inputs.denoise = denoise;
    }
  }
  return workflow;
}

// ─── Provider ────────────────────────────────────────────────

export class ComfyUIProvider implements AIProvider {
  private baseUrl: string;

  constructor() {
    this.baseUrl = env.COMFYUI_BASE_URL;
  }

  isConfigured(): boolean {
    return !!this.baseUrl;
  }

  private authHeaders(): Record<string, string> {
    const h: Record<string, string> = {};
    if (env.COMFYUI_API_KEY) h['Authorization'] = `Bearer ${env.COMFYUI_API_KEY}`;
    if (env.COMFYUI_AUTH_HEADER) {
      const [k, ...rest] = env.COMFYUI_AUTH_HEADER.split(':');
      if (k && rest.length) h[k.trim()] = rest.join(':').trim();
    }
    return h;
  }

  async invoke(input: AIProviderInput): Promise<AIProviderResult> {
    if (!this.isConfigured()) {
      logger.warn('ComfyUI is not configured (missing COMFYUI_BASE_URL).');
      return {
        status: 'FAILED',
        errorMsg: 'COMFYUI_NOT_CONFIGURED',
        outputData: { notConfigured: true, reason: 'COMFYUI_BASE_URL missing' },
      };
    }

    const baseUrl = this.baseUrl.replace(/\/$/, '');
    const isUpscale =
      input.toolSlug?.includes('upscale') ||
      (input.params as any)?.jobType === 'IMAGE_UPSCALE';

    logger.info({ jobId: input.jobId, baseUrl, isUpscale }, 'Invoking ComfyUI Workflow API');

    try {
      // ── IMAGE_UPSCALE branch: requires a source image. ─────────
      if (isUpscale) {
        const workflowRaw = env.COMFYUI_DEFAULT_WORKFLOW_UPSCALE;
        if (!workflowRaw) {
          return {
            status: 'FAILED',
            errorMsg: 'COMFYUI_DEFAULT_WORKFLOW_UPSCALE is not set; cannot run upscale without a workflow template.',
          };
        }
        let workflow: any;
        try { workflow = JSON.parse(workflowRaw); } catch (e: any) {
          return { status: 'FAILED', errorMsg: `COMFYUI_DEFAULT_WORKFLOW_UPSCALE is not valid JSON: ${e.message}` };
        }

        let sourceUrl: string;
        try { sourceUrl = await resolveSourceImageUrl(input); } catch (e: any) {
          return { status: 'FAILED', errorMsg: e.message };
        }

        logger.info({ jobId: input.jobId, sourceUrl }, 'Downloading source image for ComfyUI upload');
        const { buffer, mimeType, extension } = await downloadImageAsBuffer(sourceUrl);
        const localName = `bt_src_${input.jobId}.${extension}`;
        const uploadedName = await uploadImageToComfyUI(baseUrl, buffer, localName, mimeType);
        logger.info({ jobId: input.jobId, uploadedName, bytes: buffer.length }, 'Source image uploaded to ComfyUI');

        injectLoadImage(workflow, uploadedName);
        injectSaveImagePrefix(workflow, input);
        injectUpscaleParams(workflow, input);

        const res = await axios.post(
          `${baseUrl}/prompt`,
          { prompt: workflow, client_id: `bt_${input.jobId}` },
          {
            headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
            timeout: env.COMFYUI_TIMEOUT_MS,
          },
        );
        const promptId = res.data?.prompt_id;
        if (!promptId) {
          return { status: 'FAILED', errorMsg: `ComfyUI /prompt returned no prompt_id: ${JSON.stringify(res.data)}` };
        }
        logger.info({ promptId }, 'ComfyUI upscale prompt enqueued');
        return { status: 'PENDING', providerJobId: promptId, outputData: { uploadedName } };
      }

      // ── Default (txt2img / edit) branch — unchanged from previous behavior ──
      let workflowRaw = '';
      if (input.toolSlug?.includes('edit')) {
        workflowRaw = env.COMFYUI_DEFAULT_WORKFLOW_IMAGE_EDIT;
      } else {
        workflowRaw = env.COMFYUI_DEFAULT_WORKFLOW_IMAGE_GENERATION;
      }

      if (!workflowRaw) {
        workflowRaw = JSON.stringify({
          "3": {
            "inputs": {
              "seed": Math.floor(Math.random() * 1000000),
              "steps": 20, "cfg": 8,
              "sampler_name": "euler", "scheduler": "normal", "denoise": 1,
              "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0],
              "latent_image": ["5", 0],
            },
            "class_type": "KSampler",
          },
          "4": { "inputs": { "ckpt_name": "v1-5-pruned-emaonly.ckpt" }, "class_type": "CheckpointLoaderSimple" },
          "5": { "inputs": { "width": 512, "height": 512, "batch_size": 1 }, "class_type": "EmptyLatentImage" },
          "6": { "inputs": { "text": (input.params as any).prompt || "cyberpunk visual art", "clip": ["4", 1] }, "class_type": "CLIPTextEncode" },
          "7": { "inputs": { "text": "blurry, low quality, deformed", "clip": ["4", 1] }, "class_type": "CLIPTextEncode" },
          "8": { "inputs": { "samples": ["3", 0], "vae": ["4", 2] }, "class_type": "VAEDecode" },
          "9": { "inputs": { "filename_prefix": `bt_${input.jobId}`, "images": ["8", 0] }, "class_type": "SaveImage" },
        });
      }

      const workflow = JSON.parse(workflowRaw);
      if (workflow["6"]?.inputs?.text !== undefined) {
        workflow["6"].inputs.text = (input.params as any).prompt || "cyberpunk visual art";
      }

      const res = await axios.post(
        `${baseUrl}/prompt`,
        { prompt: workflow, client_id: `bt_${input.jobId}` },
        {
          headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
          timeout: env.COMFYUI_TIMEOUT_MS,
        },
      );

      const promptId = res.data?.prompt_id;
      if (!promptId) {
        return { status: 'FAILED', errorMsg: `ComfyUI /prompt returned no prompt_id: ${JSON.stringify(res.data)}` };
      }
      return { status: 'PENDING', providerJobId: promptId, outputData: res.data };
    } catch (err: any) {
      logger.error({ err: err.message, status: err.response?.status, data: err.response?.data }, 'ComfyUI invocation failed');
      return {
        status: 'FAILED',
        errorMsg: err.response?.data?.error ?? err.response?.data ?? err.message ?? 'ComfyUI request failed',
      };
    }
  }

  async poll(providerJobId: string, _toolSlug: string): Promise<AIProviderResult> {
    if (!this.isConfigured()) {
      return { status: 'FAILED', errorMsg: 'ComfyUI provider not configured' };
    }
    const baseUrl = this.baseUrl.replace(/\/$/, '');
    logger.debug({ providerJobId }, 'Polling ComfyUI prompt status');

    try {
      const res = await axios.get(
        `${baseUrl}/history/${providerJobId}`,
        { headers: this.authHeaders(), timeout: env.COMFYUI_TIMEOUT_MS },
      );
      const history = res.data?.[providerJobId];
      if (!history) {
        return { status: 'PENDING', providerJobId };
      }

      const outputs = history.outputs || {};
      let filename = '';
      let subfolder = '';
      let foundType = '';

      // Prefer images with type=output
      for (const nodeId of Object.keys(outputs)) {
        const nodeOutput = outputs[nodeId];
        if (!nodeOutput?.images || nodeOutput.images.length === 0) continue;
        const preferred = nodeOutput.images.find((img: any) => (img.type || '').toLowerCase() === 'output');
        const img = preferred || nodeOutput.images[0];
        filename = img.filename;
        subfolder = img.subfolder || '';
        foundType = img.type || 'output';
        if (preferred) break;
      }

      if (!filename) {
        return {
          status: 'FAILED',
          errorMsg: 'ComfyUI job completed but no output image filename was found in history',
          outputData: history,
        };
      }

      const fileUrl = `${baseUrl}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(foundType || 'output')}`;
      logger.info({ providerJobId, fileUrl }, 'ComfyUI job completed and outputs retrieved');

      return { status: 'COMPLETED', fileUrl, outputData: history };
    } catch (err: any) {
      logger.warn({ providerJobId, err: err.message }, 'Failed to poll ComfyUI status (will retry)');
      return { status: 'PENDING', providerJobId, errorMsg: err.message };
    }
  }
}
