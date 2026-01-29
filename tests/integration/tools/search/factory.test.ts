import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SearchClientFactory } from '../../../../src/tools/search/factory.js';

const originalEnv = { ...process.env };

const resetFactory = () => {
  (SearchClientFactory as any).instance = undefined;
};

describe('SearchClientFactory (integration)', () => {
  beforeEach(() => {
    process.env = { ...originalEnv, SERPER_API_KEY: 'serper-key' };
    resetFactory();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetFactory();
  });

  it('returns a singleton factory instance', () => {
    const first = new SearchClientFactory();
    const second = new SearchClientFactory();

    expect(first).toBe(second);
  });

  it('returns the same client across factory instances', () => {
    const firstFactory = new SearchClientFactory();
    const secondFactory = new SearchClientFactory();

    const clientA = firstFactory.createSearchClient();
    const clientB = secondFactory.createSearchClient();

    expect(clientA).toBe(clientB);
  });
});
