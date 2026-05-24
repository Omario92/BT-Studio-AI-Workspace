import { AIProvider, AIProviderInput, AIProviderResult } from './provider.types';
import logger from '../../../utils/logger';

export class MockProvider implements AIProvider {
  async invoke(input: AIProviderInput): Promise<AIProviderResult> {
    logger.info({ jobId: input.jobId, toolSlug: input.toolSlug }, 'Mock AI Provider invoked');
    
    // Choose fallback fileUrl depending on tool slug category
    let fileUrl = 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80'; // art placeholder
    
    if (input.toolSlug.includes('video')) {
      fileUrl = 'https://assets.mixkit.co/videos/preview/mixkit-starry-night-sky-over-a-silent-lake-41589-large.mp4';
    } else if (input.toolSlug.includes('voice') || input.toolSlug.includes('audio') || input.toolSlug.includes('music') || input.toolSlug.includes('sfx')) {
      fileUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
    } else if (input.toolSlug === 'upscaler') {
      fileUrl = 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1600&auto=format&fit=crop&q=80';
    } else if (input.toolSlug === 'editor') {
      fileUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80';
    }

    return {
      status: 'COMPLETED',
      fileUrl,
      outputData: {
        mock: true,
        toolSlug: input.toolSlug,
        invokedAt: new Date().toISOString(),
      }
    };
  }
}
