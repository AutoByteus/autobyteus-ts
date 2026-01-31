import axios, { AxiosError } from 'axios';
import { SearchStrategy } from './base-strategy.js';

export class GoogleCSESearchStrategy extends SearchStrategy {
  static API_URL = 'https://www.googleapis.com/customsearch/v1';
  private apiKey: string;
  private cseId: string;

  constructor() {
    super();
    const apiKey = process.env.GOOGLE_CSE_API_KEY;
    const cseId = process.env.GOOGLE_CSE_ID;
    if (!apiKey || !cseId) {
      throw new Error(
        "GoogleCSESearchStrategy requires both 'GOOGLE_CSE_API_KEY' and 'GOOGLE_CSE_ID' environment variables to be set."
      );
    }
    this.apiKey = apiKey;
    this.cseId = cseId;
  }

  protected formatResults(data: Record<string, unknown>): string {
    const items = data['items'];
    if (!Array.isArray(items) || items.length === 0) {
      return 'No relevant information found for the query via Google CSE.';
    }

    const resultsStr = items
      .map((result: unknown, index: number) => {
        const record = result as Record<string, unknown>;
        return (
          `${index + 1}. ${String(record['title'] ?? 'No Title')}\n` +
          `   Link: ${String(record['link'] ?? 'No Link')}\n` +
          `   Snippet: ${String(record['snippet'] ?? 'No Snippet')}`
        );
      })
      .join('\n');

    return `Search Results:\n${resultsStr}`;
  }

  async search(query: string, numResults: number): Promise<string> {
    const params = {
      key: this.apiKey,
      cx: this.cseId,
      q: query,
      num: numResults
    };

    try {
      const response = await axios.get(GoogleCSESearchStrategy.API_URL, {
        params,
        validateStatus: () => true
      });

      if (response.status === 200) {
        return this.formatResults(response.data ?? {});
      }

      const errorText = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);
      throw new Error(`Google CSE API request failed with status ${response.status}: ${errorText}`);
    } catch (error) {
      if (error instanceof Error && (error as AxiosError).isAxiosError) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          const status = axiosError.response.status;
          const data = axiosError.response.data;
          const errorText = typeof data === 'string' ? data : JSON.stringify(data);
          throw new Error(`Google CSE API request failed with status ${status}: ${errorText}`);
        }
        throw new Error(`A network error occurred during Google CSE search: ${axiosError.message}`);
      }
      throw error;
    }
  }
}
