import { randomUUID } from 'node:crypto';
import { BaseLLM } from '../base.js';
import { LLMModel } from '../models.js';
import { LLMConfig } from '../utils/llm_config.js';
import { LLMUserMessage } from '../user_message.js';
import { CompleteResponse, ChunkResponse } from '../utils/response_types.js';
import { TokenUsage } from '../utils/token_usage.js';
import { AutobyteusClient } from '../../clients/autobyteus_client.js';

export class AutobyteusLLM extends BaseLLM {
  private client: AutobyteusClient;
  private conversationId: string;

  constructor(model: LLMModel, llmConfig: LLMConfig) {
    if (!model.host_url) {
      throw new Error('AutobyteusLLM requires a host_url to be set on the LLMModel.');
    }

    super(model, llmConfig);

    this.client = new AutobyteusClient(model.host_url);
    this.conversationId = randomUUID();
  }

  protected async _sendUserMessageToLLM(
    userMessage: LLMUserMessage,
    _kwargs: Record<string, any>
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

    const assistantMessage =
      response?.response ??
      response?.content ??
      response?.message ??
      '';
    this.addAssistantMessage({ content: assistantMessage });

    const tokenUsageData = response?.token_usage ?? {};
    const tokenUsage: TokenUsage = {
      prompt_tokens: tokenUsageData.prompt_tokens ?? 0,
      completion_tokens: tokenUsageData.completion_tokens ?? 0,
      total_tokens: tokenUsageData.total_tokens ?? 0
    };

    return new CompleteResponse({
      content: assistantMessage,
      usage: tokenUsage
    });
  }

  protected async *_streamUserMessageToLLM(
    userMessage: LLMUserMessage,
    _kwargs: Record<string, any>
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

      const content = chunk?.content ?? '';
      if (content) {
        completeResponse += content;
      }

      const isComplete = Boolean(chunk?.is_complete ?? false);
      let usage: TokenUsage | null = null;

      if (isComplete) {
        const tokenUsageData = chunk?.token_usage ?? {};
        usage = {
          prompt_tokens: tokenUsageData.prompt_tokens ?? 0,
          completion_tokens: tokenUsageData.completion_tokens ?? 0,
          total_tokens: tokenUsageData.total_tokens ?? 0
        };
      }

      yield new ChunkResponse({
        content,
        reasoning: chunk?.reasoning ?? null,
        is_complete: isComplete,
        image_urls: chunk?.image_urls ?? [],
        audio_urls: chunk?.audio_urls ?? [],
        video_urls: chunk?.video_urls ?? [],
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
