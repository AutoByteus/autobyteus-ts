import type { MultimediaConfig } from '../utils/multimedia_config.js';
import type { SpeechGenerationResponse } from '../utils/response_types.js';
import type { AudioModel } from './audio_model.js';

export abstract class BaseAudioClient {
  model: AudioModel;
  config: MultimediaConfig;

  constructor(model: AudioModel, config: MultimediaConfig) {
    this.model = model;
    this.config = config;
  }

  abstract generateSpeech(
    prompt: string,
    generationConfig?: Record<string, any>,
    ...args: any[]
  ): Promise<SpeechGenerationResponse>;

  async cleanup(): Promise<void> {
    // optional override
  }
}
