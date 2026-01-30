import { Mistral } from '@mistralai/mistralai';
import { BaseLLM } from '../base.js';
import { LLMModel } from '../models.js';
import { LLMConfig } from '../utils/llm_config.js';
import { LLMUserMessage } from '../user_message.js';
import { CompleteResponse, ChunkResponse } from '../utils/response_types.js';
import { TokenUsage } from '../utils/token_usage.js';
import { Message, MessageRole } from '../utils/messages.js';
import { mediaSourceToBase64, createDataUri, getMimeType, isValidMediaPath } from '../utils/media_payload_formatter.js';
import { convertMistralToolCalls } from '../converters/mistral_tool_call_converter.js';
import { LLMProvider } from '../providers.js';

async function formatMistralMessages(messages: Message[]): Promise<any[]> {
  const formatted: any[] = [];

  for (const msg of messages) {
    if (msg.role !== MessageRole.SYSTEM && !msg.content && msg.image_urls.length === 0) {
      continue;
    }

    let content: any = msg.content ?? '';

    if (msg.image_urls.length > 0) {
      const parts: any[] = [];
      if (msg.content) {
        parts.push({ type: 'text', text: msg.content });
      }

      for (const url of msg.image_urls) {
        try {
          const b64 = await mediaSourceToBase64(url);
          let mimeType = 'image/jpeg';
          if (await isValidMediaPath(url)) {
            mimeType = getMimeType(url);
          }
          const dataUri = createDataUri(mimeType, b64);
          parts.push({
            type: 'image_url',
            imageUrl: {
              url: dataUri.image_url.url
            }
          });
        } catch (error) {
          console.error(`Error processing image ${url}: ${error}`);
        }
      }

      content = parts;
    }

    formatted.push({
      role: msg.role,
      content
    });
  }

  return formatted;
}

export class MistralLLM extends BaseLLM {
  protected client: Mistral;
  protected maxTokens: number | null;

  constructor(model?: LLMModel, llmConfig?: LLMConfig) {
    const effectiveModel =
      model ??
      new LLMModel({
        name: 'mistral-large',
        value: 'mistral-large-latest',
        canonicalName: 'mistral-large',
        provider: LLMProvider.MISTRAL
      });

    const config = llmConfig ?? new LLMConfig();
    super(effectiveModel, config);

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error('MISTRAL_API_KEY environment variable is not set.');
    }

    this.client = new Mistral({ apiKey });
    this.maxTokens = config.maxTokens ?? null;
  }

  private toTokenUsage(usage: any): TokenUsage | null {
    if (!usage) return null;
    return {
      prompt_tokens: usage.prompt_tokens ?? 0,
      completion_tokens: usage.completion_tokens ?? 0,
      total_tokens: usage.total_tokens ?? 0
    };
  }

  protected async _sendUserMessageToLLM(userMessage: LLMUserMessage, kwargs: Record<string, unknown>): Promise<CompleteResponse> {
    this.addUserMessage(userMessage);

    const formattedMessages = await formatMistralMessages(this.messages);

    const params: any = {
      model: this.model.value,
      messages: formattedMessages,
      temperature: this.config.temperature,
      topP: this.config.topP ?? undefined,
      maxTokens: this.maxTokens ?? undefined,
      ...kwargs
    };

    if (this.config.extraParams) {
      Object.assign(params, this.config.extraParams);
    }

    try {
      const response = await this.client.chat.complete(params);
      const message = response.choices?.[0]?.message;
      let content = '';
      if (typeof message?.content === 'string') {
        content = message.content;
      } else if (Array.isArray(message?.content)) {
        content = message.content
          .filter((part: any) => part?.type === 'text')
          .map((part: any) => part?.text ?? '')
          .join('');
      }

      this.addAssistantMessage({ content });

      return new CompleteResponse({
        content,
        usage: this.toTokenUsage(response.usage)
      });
    } catch (error) {
      throw new Error(`Error in Mistral API: ${error}`);
    }
  }

  protected async *_streamUserMessageToLLM(userMessage: LLMUserMessage, kwargs: Record<string, unknown>): AsyncGenerator<ChunkResponse, void, unknown> {
    this.addUserMessage(userMessage);

    const formattedMessages = await formatMistralMessages(this.messages);
    const params: any = {
      model: this.model.value,
      messages: formattedMessages,
      temperature: this.config.temperature,
      topP: this.config.topP ?? undefined,
      maxTokens: this.maxTokens ?? undefined,
      stream: true,
      ...kwargs
    };

    if (this.config.extraParams) {
      Object.assign(params, this.config.extraParams);
    }

    let accumulated = '';

    try {
      const stream = await this.client.chat.stream(params);
      for await (const event of stream) {
        const chunk = event.data;
        const choice = chunk?.choices?.[0];
        const delta = choice?.delta;

        if (delta?.content) {
          const text = typeof delta.content === 'string'
            ? delta.content
            : (delta.content ?? [])
                .filter((part: any) => part?.type === 'text')
                .map((part: any) => part?.text ?? '')
                .join('');
          if (text) {
            accumulated += text;
            yield new ChunkResponse({ content: text });
          }
        }

        if (delta?.toolCalls) {
          const toolCalls = Array.isArray(delta.toolCalls) ? delta.toolCalls : null;
          const toolDeltas = convertMistralToolCalls(toolCalls);
          if (toolDeltas) {
            yield new ChunkResponse({ content: '', tool_calls: toolDeltas });
          }
        }

        if (chunk?.usage) {
          yield new ChunkResponse({
            content: '',
            is_complete: true,
            usage: this.toTokenUsage(chunk.usage)
          });
        }
      }

      this.addAssistantMessage({ content: accumulated });
    } catch (error) {
      throw new Error(`Error in Mistral streaming: ${error}`);
    }
  }

  async cleanup(): Promise<void> {
    await super.cleanup();
  }
}
