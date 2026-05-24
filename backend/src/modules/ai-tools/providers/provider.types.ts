export interface AIProviderInput {
  toolSlug: string;
  params: Record<string, unknown>;
  jobId: string;
}

export interface AIProviderResult {
  fileUrl?: string; // S3 or original output image/video/audio url
  outputData?: Record<string, unknown>;
  status: 'COMPLETED' | 'FAILED' | 'PENDING';
  errorMsg?: string;
  providerJobId?: string; // For polling providers
}

export interface AIProvider {
  invoke(input: AIProviderInput): Promise<AIProviderResult>;
  poll?(providerJobId: string, toolSlug: string): Promise<AIProviderResult>;
}
