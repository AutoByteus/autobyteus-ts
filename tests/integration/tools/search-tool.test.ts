import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Search } from '../../../src/tools/search-tool.js';
import { SearchClientFactory } from '../../../src/tools/search/factory.js';
import { SearchClient } from '../../../src/tools/search/client.js';
import { SerperSearchStrategy } from '../../../src/tools/search/serper-strategy.js';

const originalEnv = { ...process.env };

const resetFactory = () => {
  (SearchClientFactory as any).instance = undefined;
};

describe('Search tool (integration)', () => {
  beforeEach(() => {
    process.env = { ...originalEnv, SERPER_API_KEY: 'serper-key' };
    resetFactory();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetFactory();
  });

  it('initializes using the configured search client', () => {
    const tool = new Search();
    const client = (tool as any).searchClient;

    expect(client).toBeInstanceOf(SearchClient);
    expect((client as any).strategy).toBeInstanceOf(SerperSearchStrategy);
  });
});
