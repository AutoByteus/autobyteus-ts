import { describe, it, expect } from 'vitest';
import { SearchProvider } from '../../../../src/tools/search/providers.js';

describe('SearchProvider', () => {
  it('exposes provider string values', () => {
    expect(SearchProvider.SERPER).toBe('serper');
    expect(SearchProvider.GOOGLE_CSE).toBe('google_cse');
    expect(SearchProvider.SERPAPI).toBe('serpapi');
  });
});
