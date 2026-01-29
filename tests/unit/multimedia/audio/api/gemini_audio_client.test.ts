import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import { GeminiAudioClient } from '../../../../../src/multimedia/audio/api/gemini_audio_client.js';
import { MultimediaConfig } from '../../../../../src/multimedia/utils/multimedia_config.js';

const generateContentMock = vi.fn();

vi.mock('../../../../../src/utils/gemini_helper.js', () => ({
  initializeGeminiClientWithRuntime: () => ({
    client: { models: { generateContent: generateContentMock } },
    runtimeInfo: { runtime: 'api_key' }
  })
}));

vi.mock('../../../../../src/utils/gemini_model_mapping.js', () => ({
  resolveModelForRuntime: (modelValue: string) => modelValue
}));

describe('GeminiAudioClient', () => {
  beforeEach(() => {
    generateContentMock.mockReset();
  });

  it('writes audio file from inline data', async () => {
    const audioBytes = Buffer.from([1, 2, 3, 4]);
    generateContentMock.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: {
                  data: audioBytes.toString('base64'),
                  mimeType: 'audio/wav'
                }
              }
            ]
          }
        }
      ]
    });

    const model = { name: 'gemini-tts', value: 'gemini-2.5-flash-preview-tts' } as any;
    const client = new GeminiAudioClient(model, new MultimediaConfig());

    const response = await client.generateSpeech('hello');
    expect(response.audio_urls.length).toBe(1);

    const audioPath = response.audio_urls[0];
    const stat = await fs.stat(audioPath);
    expect(stat.isFile()).toBe(true);
    expect(audioPath.endsWith('.wav')).toBe(true);

    await fs.unlink(audioPath);
  });
});
