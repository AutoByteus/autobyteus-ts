import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { GoogleCSESearchStrategy } from '../../../../src/tools/search/google_cse_strategy.js';

const originalEnv = { ...process.env };

describe('GoogleCSESearchStrategy (integration)', () => {
  beforeEach(() => {
    process.env.GOOGLE_CSE_API_KEY = 'test-key';
    process.env.GOOGLE_CSE_ID = 'test-id';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('passes query params to Google CSE', async () => {
    const getSpy = vi.spyOn(axios, 'get').mockResolvedValue({
      status: 200,
      data: { items: [] }
    } as any);

    const strategy = new GoogleCSESearchStrategy();
    await strategy.search('hello', 4);

    expect(getSpy).toHaveBeenCalled();
    const [url, config] = getSpy.mock.calls[0] ?? [];
    expect(url).toBe(GoogleCSESearchStrategy.API_URL);
    expect(config).toBeDefined();
    expect((config as any).params).toEqual({
      key: 'test-key',
      cx: 'test-id',
      q: 'hello',
      num: 4
    });
  });
});
