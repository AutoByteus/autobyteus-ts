import { Ollama } from 'ollama';
import { BaseLLM } from '../base.js';
import { LLMModel } from '../models.js';
import { LLMConfig } from '../utils/llm_config.js';
import { LLMUserMessage } from '../user_message.js';
import { CompleteResponse, ChunkResponse } from '../utils/response_types.js';
import { TokenUsage } from '../utils/token_usage.js';
import { Message } from '../utils/messages.js';
import { mediaSourceToBase64 } from '../utils/media_payload_formatter.js';

type OllamaMessage = {
  role: string;
  content: string;
  images?: string[];
};

export class OllamaLLM extends BaseLLM {
  private client: Ollama;

  constructor(model: LLMModel, llmConfig: LLMConfig) {
    if (!model.hostUrl) {
      throw new Error('OllamaLLM requires a hostUrl to be set on the LLMModel.');
    }

    super(model, llmConfig);
    this.client = new Ollama({ host: model.hostUrl });
  }

  private async formatOllamaMessages(messages: Message[]): Promise<OllamaMessage[]> {
    const formatted: OllamaMessage[] = [];

    for (const msg of messages) {
      const entry: OllamaMessage = {
        role: msg.role,
        content: msg.content ?? ''
      };

      if (msg.image_urls.length > 0) {
        try {
          const images = await Promise.all(msg.image_urls.map((url) => mediaSourceToBase64(url)));
          if (images.length > 0) {
            entry.images = images;
          }
        } catch (error) {
          console.error(`Error processing images for Ollama, skipping them. Error: ${error}`);
        }
      }

      formatted.push(entry);
    }

    return formatted;
  }

  protected async _sendUserMessageToLLM(
    userMessage: LLMUserMessage,
    _kwargs: Record<string, unknown>
  ): Promise<CompleteResponse> {
    this.addUserMessage(userMessage);

    const formattedMessages = await this.formatOllamaMessages(this.messages);
    const response: any = await this.client.chat({
      model: this.model.value,
      messages: formattedMessages
    });

    const assistantMessage = response?.message?.content ?? '';
    let reasoning: string | null = null;
    let mainContent = assistantMessage;

    if (assistantMessage.includes('<think>') && assistantMessage.includes('</think>')) {
      const startIndex = assistantMessage.indexOf('<think>');
      const endIndex = assistantMessage.indexOf('</think>');
      if (startIndex < endIndex) {
        reasoning = assistantMessage.slice(startIndex + '<think>'.length, endIndex).trim();
        mainContent = (assistantMessage.slice(0, startIndex) + assistantMessage.slice(endIndex + '</think>'.length)).trim();
      }
    }

    this.addAssistantMessage({ content: mainContent, reasoning_content: reasoning });

    const promptTokens = response?.prompt_eval_count ?? 0;
    const completionTokens = response?.eval_count ?? 0;
    const usage: TokenUsage = {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens
    };

    return new CompleteResponse({
      content: mainContent,
      reasoning,
      usage
    });
  }

  protected async *_streamUserMessageToLLM(
    userMessage: LLMUserMessage,
    _kwargs: Record<string, unknown>
  ): AsyncGenerator<ChunkResponse, void, unknown> {
    this.addUserMessage(userMessage);
    const formattedMessages = await this.formatOllamaMessages(this.messages);

    const stream = await this.client.chat({
      model: this.model.value,
      messages: formattedMessages,
      stream: true
    });

    let accumulatedMain = '';
    let accumulatedReasoning = '';
    let inReasoning = false;
    let finalResponse: any = null;

    for await (const part of stream as AsyncIterable<any>) {
      let token: string = part?.message?.content ?? '';

      if (token.includes('<think>')) {
        inReasoning = true;
        const parts = token.split('<think>');
        token = parts[parts.length - 1] ?? '';
      }

      if (token.includes('</think>')) {
        inReasoning = false;
        const parts = token.split('</think>');
        token = parts[parts.length - 1] ?? '';
      }

      if (inReasoning) {
        accumulatedReasoning += token;
        yield new ChunkResponse({ content: '', reasoning: token });
      } else {
        accumulatedMain += token;
        if (token) {
          yield new ChunkResponse({ content: token, reasoning: null });
        }
      }

      if (part?.done) {
        finalResponse = part;
      }
    }

    let usage: TokenUsage | null = null;
    if (finalResponse) {
      const promptTokens = finalResponse?.prompt_eval_count ?? 0;
      const completionTokens = finalResponse?.eval_count ?? 0;
      usage = {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens
      };
    }

    yield new ChunkResponse({ content: '', reasoning: null, is_complete: true, usage });
    this.addAssistantMessage({ content: accumulatedMain, reasoning_content: accumulatedReasoning });
  }
}
