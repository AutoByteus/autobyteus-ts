import { describe, it, expect } from 'vitest';
import { MultimediaProvider } from '../../../src/multimedia/providers.js';

describe('MultimediaProvider', () => {
  it('exposes expected provider values', () => {
    expect(MultimediaProvider.OPENAI).toBe('OPENAI');
    expect(MultimediaProvider.GEMINI).toBe('GEMINI');
    expect(MultimediaProvider.ALIBABA_QWEN).toBe('ALIBABA_QWEN');
    expect(MultimediaProvider.AUTOBYTEUS).toBe('AUTOBYTEUS');
  });
});
