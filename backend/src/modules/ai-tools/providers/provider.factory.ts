import { AIProvider } from './provider.types';
import { MockProvider } from './mock.provider';
import { RunPodProvider } from './runpod.provider';
import { ComfyUIProvider } from './comfyui.provider';

const mockProvider = new MockProvider();
const runpodProvider = new RunPodProvider();
const comfyuiProvider = new ComfyUIProvider();

export function getAIProvider(providerName?: string): AIProvider {
  const name = (providerName || 'mock').toLowerCase();
  if (name === 'runpod') return runpodProvider;
  if (name === 'comfyui') return comfyuiProvider;
  return mockProvider;
}
