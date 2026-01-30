import { randomUUID } from 'node:crypto';
import { BaseLLM } from '../base.js';
import { LLMModel } from '../models.js';
import { LLMConfig } from '../utils/llm_config.js';
import { LLMUserMessage } from '../user_message.js';
import { CompleteResponse, ChunkResponse } from '../utils/response_types.js';
import { TokenUsage } from '../utils/token_usage.js';
import { AutobyteusClient } from '../../clients/autobyteus_client.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const toTokenUsage = (value: unknown): TokenUsage => {
  const record = isRecord(value) ? value : {};
  return {
    prompt_tokens: typeof record.prompt_tokens === 'number' ? record.prompt_tokens : 0,
    completion_tokens: typeof record.completion_tokens === 'number' ? record.completion_tokens : 0,
    total_tokens: typeof record.total_tokens === 'number' ? record.total_tokens : 0
  };
};

export class AutobyteusLLM extends BaseLLM {
  private client: AutobyteusClient;
  private conversationId: string;

  constructor(model: LLMModel, llmConfig: LLMConfig) {
    if (!model.hostUrl) {
      throw new Error('AutobyteusLLM requires a hostUrl to be set on the LLMModel.');
    }

    super(model, llmConfig);

    this.client = new AutobyteusClient(model.hostUrl);
    this.conversationId = randomUUID();
  }

  protected async _sendUserMessageToLLM(
    userMessage: LLMUserMessage,
    _kwargs: Record<string, unknown>
  ): Promise<CompleteResponse> {
    this.addUserMessage(userMessage);

    const response = await this.client.sendMessage(
      this.conversationId,
      this.model.name,
      userMessage.content,
      userMessage.image_urls,
      userMessage.audio_urls,
      userMessage.video_urls
    );

    const responseRecord = isRecord(response) ? response : {};
    const assistantMessage =
      asString(responseRecord.response) ??
      asString(responseRecord.content) ??
      asString(responseRecord.message) ??
      '';
    this.addAssistantMessage({ content: assistantMessage });

    const tokenUsage = toTokenUsage(responseRecord.token_usage);

    return new CompleteResponse({
      content: assistantMessage,
      usage: tokenUsage
    });
  }

  protected async *_streamUserMessageToLLM(
    userMessage: LLMUserMessage,
    _kwargs: Record<string, unknown>
  ): AsyncGenerator<ChunkResponse, void, unknown> {
    this.addUserMessage(userMessage);
    let completeResponse = '';

    for await (const chunk of this.client.streamMessage(
      this.conversationId,
      this.model.name,
      userMessage.content,
      userMessage.image_urls,
      userMessage.audio_urls,
      userMessage.video_urls
    )) {
      if (chunk?.error) {
        throw new Error(String(chunk.error));
      }

      const chunkRecord = isRecord(chunk) ? chunk : {};
      const content = asString(chunkRecord.content) ?? '';
      if (content) {
        completeResponse += content;
      }

      const isComplete = Boolean(chunkRecord.is_complete ?? false);
      let usage: TokenUsage | null = null;

      if (isComplete) {
        usage = toTokenUsage(chunkRecord.token_usage);
      }

      yield new ChunkResponse({
        content,
        reasoning: asString(chunkRecord.reasoning) ?? null,
        is_complete: isComplete,
        image_urls: asStringArray(chunkRecord.image_urls),
        audio_urls: asStringArray(chunkRecord.audio_urls),
        video_urls: asStringArray(chunkRecord.video_urls),
        usage
      });
    }

    this.addAssistantMessage({ content: completeResponse });
  }

  async cleanup(): Promise<void> {
    await this.client.cleanup(this.conversationId);
    await super.cleanup();
  }
}
