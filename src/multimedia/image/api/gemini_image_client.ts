import mime from 'mime-types';
import { BaseImageClient } from '../base_image_client.js';
import { ImageGenerationResponse } from '../../utils/response_types.js';
import { loadImageFromUrl } from '../../utils/api_utils.js';
import { initializeGeminiClientWithRuntime } from '../../../utils/gemini_helper.js';
import { resolveModelForRuntime } from '../../../utils/gemini_model_mapping.js';

function guessMimeType(source: string): string {
  const mimeType = mime.lookup(source);
  return mimeType || 'image/png';
}

export class GeminiImageClient extends BaseImageClient {
  private client: any;
  private runtimeInfo: { runtime: string } | null;

  constructor(model: any, config: any) {
    super(model, config);
    const { client, runtimeInfo } = initializeGeminiClientWithRuntime();
    this.client = client;
    this.runtimeInfo = runtimeInfo;
  }

  async generateImage(
    prompt: string,
    inputImageUrls?: string[] | null,
    generationConfig?: Record<string, any>
  ): Promise<ImageGenerationResponse> {
    try {
      const contentParts: any[] = [prompt];
      if (inputImageUrls && inputImageUrls.length > 0) {
        for (const url of inputImageUrls) {
          try {
            const imageBytes = await loadImageFromUrl(url);
            const mimeType = guessMimeType(url);
            contentParts.push({
              inlineData: {
                data: Buffer.from(imageBytes).toString('base64'),
                mimeType
              }
            });
          } catch (error) {
            console.error(`Skipping image at '${url}' due to loading error: ${error}`);
          }
        }
      }

      const configDict: Record<string, any> = { ...(this.config?.params ?? {}) };
      if (generationConfig) {
        Object.assign(configDict, generationConfig);
      }

      if (!configDict.responseModalities) {
        if (this.runtimeInfo?.runtime === 'vertex') {
          configDict.responseModalities = ['TEXT', 'IMAGE'];
        } else {
          configDict.responseModalities = ['IMAGE'];
        }
      }

      const runtimeAdjustedModel = resolveModelForRuntime(
        this.model.value,
        'image',
        this.runtimeInfo?.runtime
      );

      const response = await this.client.models.generateContent({
        model: runtimeAdjustedModel,
        contents: contentParts,
        config: configDict
      });

      const imageUrls: string[] = [];
      const parts = response?.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.mimeType && part.inlineData.mimeType.includes('image') && part.inlineData.data) {
          const dataUri = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          imageUrls.push(dataUri);
        }
      }

      if (imageUrls.length === 0) {
        const blockReason = response?.promptFeedback?.blockReason;
        if (blockReason) {
          throw new Error(`Image generation failed due to safety settings: ${blockReason}`);
        }
        throw new Error('Gemini API did not return any processable images.');
      }

      return new ImageGenerationResponse(imageUrls, undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Unsupported') && message.includes('location')) {
        throw new Error('Image generation is not supported in your configured region. Please check your Google Cloud project settings.');
      }
      throw new Error(`Google Gemini image generation failed: ${message}`);
    }
  }

  async editImage(
    prompt: string,
    inputImageUrls: string[],
    maskUrl?: string | null,
    generationConfig?: Record<string, any>
  ): Promise<ImageGenerationResponse> {
    if (maskUrl) {
      console.warn(
        `The GeminiImageClient for model '${this.model.name}' received a 'mask_url' but does not support explicit masking. The mask will be ignored.`
      );
    }

    return this.generateImage(prompt, inputImageUrls, generationConfig);
  }
}
