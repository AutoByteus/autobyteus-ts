import { Singleton } from '../../utils/singleton.js';
import { SearchProvider } from './providers.js';
import { SearchClient } from './client.js';
import { SerperSearchStrategy } from './serper-strategy.js';
import { SerpApiSearchStrategy } from './serpapi-strategy.js';
import { GoogleCSESearchStrategy } from './google-cse-strategy.js';

export class SearchClientFactory extends Singleton {
  protected static instance?: SearchClientFactory;

  private client: SearchClient | null = null;

  constructor() {
    super();
    if (SearchClientFactory.instance) {
      return SearchClientFactory.instance;
    }
    SearchClientFactory.instance = this;
  }

  createSearchClient(): SearchClient {
    if (this.client) {
      return this.client;
    }

    const providerName = (process.env.DEFAULT_SEARCH_PROVIDER || '').toLowerCase();
    const serperKey = process.env.SERPER_API_KEY;
    const serpapiKey = process.env.SERPAPI_API_KEY;
    const googleApiKey = process.env.GOOGLE_CSE_API_KEY;
    const googleCseId = process.env.GOOGLE_CSE_ID;

    const isSerperConfigured = Boolean(serperKey);
    const isSerpapiConfigured = Boolean(serpapiKey);
    const isGoogleCseConfigured = Boolean(googleApiKey && googleCseId);

    let strategy: SerperSearchStrategy | SerpApiSearchStrategy | GoogleCSESearchStrategy | null = null;

    if (providerName === SearchProvider.GOOGLE_CSE) {
      if (isGoogleCseConfigured) {
        strategy = new GoogleCSESearchStrategy();
      } else {
        throw new Error(
          "DEFAULT_SEARCH_PROVIDER is 'google_cse', but Google CSE is not configured. " +
          'Set GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID.'
        );
      }
    } else if (providerName === SearchProvider.SERPAPI) {
      if (isSerpapiConfigured) {
        strategy = new SerpApiSearchStrategy();
      } else {
        throw new Error(
          "DEFAULT_SEARCH_PROVIDER is 'serpapi', but SerpApi is not configured. " +
          'Set SERPAPI_API_KEY.'
        );
      }
    } else if (providerName === SearchProvider.SERPER || isSerperConfigured) {
      if (isSerperConfigured) {
        strategy = new SerperSearchStrategy();
      } else {
        throw new Error(
          "DEFAULT_SEARCH_PROVIDER is 'serper', but Serper is not configured. Set SERPER_API_KEY."
        );
      }
    } else if (isSerpapiConfigured) {
      strategy = new SerpApiSearchStrategy();
    } else if (isGoogleCseConfigured) {
      strategy = new GoogleCSESearchStrategy();
    } else {
      throw new Error(
        'No search provider is configured. Please set either SERPER_API_KEY, SERPAPI_API_KEY, ' +
        'or both GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID environment variables.'
      );
    }

    this.client = new SearchClient(strategy);
    return this.client;
  }
}
