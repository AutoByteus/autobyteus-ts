import axios, { AxiosError } from 'axios';
import { SearchStrategy } from './base_strategy.js';

export class SerperSearchStrategy extends SearchStrategy {
  static API_URL = 'https://google.serper.dev/search';
  private apiKey: string;

  constructor() {
    super();
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      throw new Error("SerperSearchStrategy requires the 'SERPER_API_KEY' environment variable to be set.");
    }
    this.apiKey = apiKey;
  }

  protected formatResults(data: Record<string, any>): string {
    const summaryParts: string[] = [];

    if (data.answerBox) {
      const title = data.answerBox.title ?? '';
      const snippet = data.answerBox.snippet ?? data.answerBox.answer;
      summaryParts.push(`Direct Answer for '${title}':\n${snippet}`);
    }

    if (data.knowledgeGraph) {
      const title = data.knowledgeGraph.title ?? '';
      const description = data.knowledgeGraph.description ?? '';
      summaryParts.push(`Summary for '${title}':\n${description}`);
    }

    if (Array.isArray(data.organic) && data.organic.length > 0) {
      const resultsStr = data.organic
        .map((result: Record<string, any>, index: number) => (
          `${index + 1}. ${result.title ?? 'No Title'}\n` +
          `   Link: ${result.link ?? 'No Link'}\n` +
          `   Snippet: ${result.snippet ?? 'No Snippet'}`
        ))
        .join('\n');
      summaryParts.push(`Search Results:\n${resultsStr}`);
    }

    if (summaryParts.length === 0) {
      return 'No relevant information found for the query via Serper.';
    }

    return summaryParts.join('\n\n---\n\n');
  }

  async search(query: string, numResults: number): Promise<string> {
    const headers = {
      'X-API-KEY': this.apiKey,
      'Content-Type': 'application/json'
    };

    try {
      const response = await axios.post(
        SerperSearchStrategy.API_URL,
        { q: query, num: numResults },
        { headers, validateStatus: () => true }
      );

      if (response.status === 200) {
        return this.formatResults(response.data ?? {});
      }

      const errorText = typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);
      throw new Error(`Serper API request failed with status ${response.status}: ${errorText}`);
    } catch (error) {
      if (error instanceof Error && (error as AxiosError).isAxiosError) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          const status = axiosError.response.status;
          const data = axiosError.response.data;
          const errorText = typeof data === 'string' ? data : JSON.stringify(data);
          throw new Error(`Serper API request failed with status ${status}: ${errorText}`);
        }
        throw new Error(`A network error occurred during Serper search: ${axiosError.message}`);
      }
      throw error;
    }
  }
}
