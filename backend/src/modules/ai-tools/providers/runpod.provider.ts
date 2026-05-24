import axios from 'axios';
import { env } from '../../../config/env';
import { AIProvider, AIProviderInput, AIProviderResult } from './provider.types';
import logger from '../../../utils/logger';

export class RunPodProvider implements AIProvider {
  private apiKey: string;
  private endpointId: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = env.RUNPOD_API_KEY;
    this.endpointId = env.RUNPOD_ENDPOINT_ID;
    this.baseUrl = env.RUNPOD_BASE_URL;
  }

  private isConfigured(): boolean {
    return !!(this.apiKey && this.endpointId);
  }

  async invoke(input: AIProviderInput): Promise<AIProviderResult> {
    if (!this.isConfigured()) {
      logger.warn('RunPod is not fully configured (missing API key or Endpoint ID). Falling back to mock output.');
      return {
        status: 'COMPLETED',
        fileUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800',
        outputData: { mockFallback: true, reason: 'RUNPOD_NOT_CONFIGURED' }
      };
    }

    logger.info({ jobId: input.jobId, endpointId: this.endpointId }, 'Invoking RunPod Serverless Endpoint');

    try {
      const res = await axios.post(
        `${this.baseUrl}/${this.endpointId}/run`,
        {
          input: {
            tool: input.toolSlug,
            params: input.params,
            jobId: input.jobId
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      const runpodJobId = res.data.id;
      const runpodStatus = res.data.status;

      logger.info({ runpodJobId, status: runpodStatus }, 'RunPod job successfully submitted');

      if (runpodStatus === 'COMPLETED') {
        // Simple/sync runs completed immediately
        const output = res.data.output;
        const fileUrl = typeof output === 'string' ? output : (output?.fileUrl ?? output?.url ?? null);
        return {
          status: 'COMPLETED',
          fileUrl: fileUrl || undefined,
          outputData: res.data
        };
      }

      return {
        status: 'PENDING',
        providerJobId: runpodJobId,
        outputData: res.data
      };
    } catch (err: any) {
      logger.error({ err: err.message }, 'RunPod invocation failed');
      return {
        status: 'FAILED',
        errorMsg: err.response?.data?.error ?? err.message
      };
    }
  }

  async poll(providerJobId: string, _toolSlug: string): Promise<AIProviderResult> {
    if (!this.isConfigured()) {
      return { status: 'FAILED', errorMsg: 'RunPod provider not configured' };
    }

    logger.debug({ providerJobId }, 'Polling RunPod job status');

    try {
      const res = await axios.get(
        `${this.baseUrl}/${this.endpointId}/status/${providerJobId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      const status = res.data.status;
      logger.debug({ providerJobId, status }, 'RunPod polling status response');

      if (status === 'COMPLETED') {
        const output = res.data.output;
        const fileUrl = typeof output === 'string' ? output : (output?.fileUrl ?? output?.url ?? null);
        return {
          status: 'COMPLETED',
          fileUrl: fileUrl || undefined,
          outputData: res.data
        };
      }

      if (status === 'FAILED') {
        return {
          status: 'FAILED',
          errorMsg: res.data.error || 'RunPod job execution failed'
        };
      }

      if (status === 'CANCELLED') {
        return {
          status: 'FAILED',
          errorMsg: 'RunPod job was cancelled'
        };
      }

      return {
        status: 'PENDING',
        providerJobId,
        outputData: res.data
      };
    } catch (err: any) {
      logger.error({ providerJobId, err: err.message }, 'Failed to poll RunPod status');
      return {
        status: 'PENDING', // Keep retry/pending state on network transient errors
        providerJobId,
        errorMsg: err.message
      };
    }
  }
}
