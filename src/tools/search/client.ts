import { SearchStrategy } from './base_strategy.js';

export class SearchClient {
  private strategy: SearchStrategy;

  constructor(strategy: SearchStrategy) {
    if (!strategy) {
      throw new Error('SearchClient must be initialized with a valid SearchStrategy.');
    }
    this.strategy = strategy;
  }

  async search(query: string, numResults: number): Promise<string> {
    return this.strategy.search(query, numResults);
  }
}
