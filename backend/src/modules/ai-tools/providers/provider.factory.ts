import { AIProvider } from './provider.types';
import { MockProvider } from './mock.provider';
import { RunPodProvider } from './runpod.provider';
import { ComfyUIProvider } from './comfyui.provider';
import { ReplicateProvider } from './replicate.provider';

const mockProvider = new MockProvider();
const runpodProvider = new RunPodProvider();
const comfyuiProvider = new ComfyUIProvider();
const replicateProvider = new ReplicateProvider();

export function getAIProvider(providerName?: string): AIProvider {
  const name = (providerName || 'mock').toLowerCase();
  if (name === 'runpod')    return runpodProvider;
  if (name === 'comfyui')   return comfyuiProvider;
  if (name === 'replicate') return replicateProvider;
  return mockProvider;
}
