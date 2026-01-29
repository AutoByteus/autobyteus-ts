import type { MultimediaConfig } from '../utils/multimedia_config.js';
import type { ImageGenerationResponse } from '../utils/response_types.js';
import type { ImageModel } from './image_model.js';

export abstract class BaseImageClient {
  model: ImageModel;
  config: MultimediaConfig;

  constructor(model: ImageModel, config: MultimediaConfig) {
    this.model = model;
    this.config = config;
  }

  abstract generateImage(
    prompt: string,
    inputImageUrls?: string[] | null,
    generationConfig?: Record<string, any>,
    ...args: any[]
  ): Promise<ImageGenerationResponse>;

  abstract editImage(
    prompt: string,
    inputImageUrls: string[],
    maskUrl?: string | null,
    generationConfig?: Record<string, any>,
    ...args: any[]
  ): Promise<ImageGenerationResponse>;

  async cleanup(): Promise<void> {
    // optional override
  }
}
