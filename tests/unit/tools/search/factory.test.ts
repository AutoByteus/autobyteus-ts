import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SearchClientFactory } from '../../../../src/tools/search/factory.js';
import { SerperSearchStrategy } from '../../../../src/tools/search/serper-strategy.js';
import { SerpApiSearchStrategy } from '../../../../src/tools/search/serpapi-strategy.js';
import { GoogleCSESearchStrategy } from '../../../../src/tools/search/google-cse-strategy.js';

const originalEnv = { ...process.env };

const resetFactory = () => {
  (SearchClientFactory as any).instance = undefined;
};

describe('SearchClientFactory', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    resetFactory();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetFactory();
  });

  it('creates Serper strategy when configured explicitly', () => {
    process.env.DEFAULT_SEARCH_PROVIDER = 'serper';
    process.env.SERPER_API_KEY = 'serper-key';

    const factory = new SearchClientFactory();
    const client = factory.createSearchClient();

    expect((client as any).strategy).toBeInstanceOf(SerperSearchStrategy);
  });

  it('creates SerpApi strategy when configured explicitly', () => {
    process.env.DEFAULT_SEARCH_PROVIDER = 'serpapi';
    process.env.SERPAPI_API_KEY = 'serpapi-key';

    const factory = new SearchClientFactory();
    const client = factory.createSearchClient();

    expect((client as any).strategy).toBeInstanceOf(SerpApiSearchStrategy);
  });

  it('creates Google CSE strategy when configured explicitly', () => {
    process.env.DEFAULT_SEARCH_PROVIDER = 'google_cse';
    process.env.GOOGLE_CSE_API_KEY = 'google-key';
    process.env.GOOGLE_CSE_ID = 'google-id';

    const factory = new SearchClientFactory();
    const client = factory.createSearchClient();

    expect((client as any).strategy).toBeInstanceOf(GoogleCSESearchStrategy);
  });

  it('defaults to Serper when available and no provider specified', () => {
    process.env.SERPER_API_KEY = 'serper-key';

    const factory = new SearchClientFactory();
    const client = factory.createSearchClient();

    expect((client as any).strategy).toBeInstanceOf(SerperSearchStrategy);
  });

  it('falls back to SerpApi when Serper unavailable', () => {
    process.env.SERPAPI_API_KEY = 'serpapi-key';

    const factory = new SearchClientFactory();
    const client = factory.createSearchClient();

    expect((client as any).strategy).toBeInstanceOf(SerpApiSearchStrategy);
  });

  it('falls back to Google CSE when Serper and SerpApi unavailable', () => {
    process.env.GOOGLE_CSE_API_KEY = 'google-key';
    process.env.GOOGLE_CSE_ID = 'google-id';

    const factory = new SearchClientFactory();
    const client = factory.createSearchClient();

    expect((client as any).strategy).toBeInstanceOf(GoogleCSESearchStrategy);
  });

  it('throws when no provider is configured', () => {
    const factory = new SearchClientFactory();
    expect(() => factory.createSearchClient()).toThrow('No search provider is configured');
  });

  it('returns the same client instance on subsequent calls', () => {
    process.env.SERPER_API_KEY = 'serper-key';

    const factory = new SearchClientFactory();
    const first = factory.createSearchClient();
    const second = factory.createSearchClient();

    expect(first).toBe(second);
  });
});
