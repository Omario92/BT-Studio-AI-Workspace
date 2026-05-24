import axios from 'axios';
import { env } from '../../../config/env';
import { AIProvider, AIProviderInput, AIProviderResult } from './provider.types';
import logger from '../../../utils/logger';

export class ComfyUIProvider implements AIProvider {
  private baseUrl: string;

  constructor() {
    this.baseUrl = env.COMFYUI_BASE_URL;
  }

  private isConfigured(): boolean {
    return !!this.baseUrl;
  }

  async invoke(input: AIProviderInput): Promise<AIProviderResult> {
    if (!this.isConfigured()) {
      logger.warn('ComfyUI is not configured (missing COMFYUI_BASE_URL). Falling back to mock output.');
      return {
        status: 'COMPLETED',
        fileUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
        outputData: { mockFallback: true, reason: 'COMFYUI_NOT_CONFIGURED' }
      };
    }

    logger.info({ jobId: input.jobId, baseUrl: this.baseUrl }, 'Invoking ComfyUI Workflow API');

    try {
      // 1. Resolve workflow JSON template
      let workflowRaw = '';
      if (input.toolSlug.includes('upscale')) {
        workflowRaw = env.COMFYUI_DEFAULT_WORKFLOW_UPSCALE;
      } else if (input.toolSlug.includes('edit')) {
        workflowRaw = env.COMFYUI_DEFAULT_WORKFLOW_IMAGE_EDIT;
      } else {
        workflowRaw = env.COMFYUI_DEFAULT_WORKFLOW_IMAGE_GENERATION;
      }

      if (!workflowRaw) {
        // Build a minimalist fallback text-to-image workflow if template is not provided
        workflowRaw = JSON.stringify({
          "3": {
            "inputs": {
              "seed": Math.floor(Math.random() * 1000000),
              "steps": 20,
              "cfg": 8,
              "sampler_name": "euler",
              "scheduler": "normal",
              "denoise": 1,
              "model": ["4", 0],
              "positive": ["6", 0],
              "negative": ["7", 0],
              "latent_image": ["5", 0]
            },
            "class_type": "KSampler"
          },
          "4": {
            "inputs": { "ckpt_name": "v1-5-pruned-emaonly.ckpt" },
            "class_type": "CheckpointLoaderSimple"
          },
          "5": {
            "inputs": { "width": 512, "height": 512, "batch_size": 1 },
            "class_type": "EmptyLatentImage"
          },
          "6": {
            "inputs": { "text": input.params.prompt || "cyberpunk visual art", "clip": ["4", 1] },
            "class_type": "CLIPTextEncode"
          },
          "7": {
            "inputs": { "text": "blurry, low quality, deformed", "clip": ["4", 1] },
            "class_type": "CLIPTextEncode"
          },
          "8": {
            "inputs": { "samples": ["3", 0], "vae": ["4", 2] },
            "class_type": "VAEDecode"
          },
          "9": {
            "inputs": { "filename_prefix": `bt_${input.jobId}`, "images": ["8", 0] },
            "class_type": "SaveImage"
          }
        });
      }

      const workflow = JSON.parse(workflowRaw);

      // Customize prompt text in CLIPTextEncode (node 6) or search dynamically
      if (workflow["6"]?.inputs?.text !== undefined) {
        workflow["6"].inputs.text = input.params.prompt || "cyberpunk visual art";
      }

      // 2. Submit prompt
      const res = await axios.post(
        `${this.baseUrl.replace(/\/$/, '')}/prompt`,
        { prompt: workflow, client_id: `bt_${input.jobId}` },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(env.COMFYUI_API_KEY ? { 'Authorization': `Bearer ${env.COMFYUI_API_KEY}` } : {})
          }
        }
      );

      const promptId = res.data.prompt_id;
      logger.info({ promptId }, 'ComfyUI prompt successfully enqueued');

      return {
        status: 'PENDING',
        providerJobId: promptId,
        outputData: res.data
      };
    } catch (err: any) {
      logger.error({ err: err.message }, 'ComfyUI invocation failed');
      return {
        status: 'FAILED',
        errorMsg: err.response?.data?.error ?? err.message
      };
    }
  }

  async poll(providerJobId: string, _toolSlug: string): Promise<AIProviderResult> {
    if (!this.isConfigured()) {
      return { status: 'FAILED', errorMsg: 'ComfyUI provider not configured' };
    }

    logger.debug({ providerJobId }, 'Polling ComfyUI prompt status');

    try {
      // ComfyUI tracks history and queues. Let's call /history/:promptId
      const res = await axios.get(
        `${this.baseUrl.replace(/\/$/, '')}/history/${providerJobId}`,
        {
          headers: env.COMFYUI_API_KEY ? { 'Authorization': `Bearer ${env.COMFYUI_API_KEY}` } : {}
        }
      );

      const history = res.data[providerJobId];
      if (!history) {
        // Still in queue or running
        return {
          status: 'PENDING',
          providerJobId
        };
      }

      // Prompt completed! Extract saved image output from history outputs
      const outputs = history.outputs;
      let filename = '';
      let subfolder = '';

      for (const nodeId of Object.keys(outputs)) {
        const nodeOutput = outputs[nodeId];
        if (nodeOutput.images && nodeOutput.images.length > 0) {
          filename = nodeOutput.images[0].filename;
          subfolder = nodeOutput.images[0].subfolder || '';
          break;
        }
      }

      if (!filename) {
        throw new Error('ComfyUI job completed but no output image filename was found in history');
      }

      // Build fetch URL
      const fileUrl = `${this.baseUrl.replace(/\/$/, '')}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=output`;
      logger.info({ providerJobId, fileUrl }, 'ComfyUI job completed and outputs retrieved!');

      return {
        status: 'COMPLETED',
        fileUrl,
        outputData: history
      };
    } catch (err: any) {
      logger.error({ providerJobId, err: err.message }, 'Failed to poll ComfyUI status');
      return {
        status: 'PENDING',
        providerJobId,
        errorMsg: err.message
      };
    }
  }
}
