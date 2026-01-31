import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { GoogleCSESearchStrategy } from '../../../../src/tools/search/google-cse-strategy.js';

const originalEnv = { ...process.env };

describe('GoogleCSESearchStrategy', () => {
  beforeEach(() => {
    process.env.GOOGLE_CSE_API_KEY = 'test-key';
    process.env.GOOGLE_CSE_ID = 'test-id';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('formats items results', () => {
    const strategy = new GoogleCSESearchStrategy();
    const output = (strategy as any).formatResults({
      items: [
        { title: 'Result 1', link: 'http://example.com', snippet: 'Snippet 1' }
      ]
    });

    expect(output).toContain('Search Results:');
    expect(output).toContain('1. Result 1');
  });

  it('returns fallback when no items', () => {
    const strategy = new GoogleCSESearchStrategy();
    const output = (strategy as any).formatResults({});
    expect(output).toBe('No relevant information found for the query via Google CSE.');
  });

  it('returns formatted results on success', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({
      status: 200,
      data: { items: [{ title: 'Title', link: 'Link', snippet: 'Snippet' }] }
    } as any);

    const strategy = new GoogleCSESearchStrategy();
    await expect(strategy.search('query', 3)).resolves.toContain('Search Results:');
  });

  it('throws a descriptive error for non-200 responses', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({
      status: 403,
      data: { error: 'forbidden' }
    } as any);

    const strategy = new GoogleCSESearchStrategy();
    await expect(strategy.search('query', 3)).rejects.toThrow(
      'Google CSE API request failed with status 403:'
    );
  });
});
