import { OpenAI as OpenAIClient } from 'openai';
import { ResponseStreamEvent } from 'openai/resources/responses/responses.mjs';
import { BaseLLM } from '../base.js';
import { LLMModel } from '../models.js';
import { LLMConfig } from '../utils/llm_config.js';
import { LLMUserMessage } from '../user_message.js';
import { Message } from '../utils/messages.js';
import { CompleteResponse, ChunkResponse } from '../utils/response_types.js';
import { TokenUsage } from '../utils/token_usage.js';
import { mediaSourceToBase64, createDataUri, getMimeType, isValidMediaPath } from '../utils/media_payload_formatter.js';
import { ToolCallDelta } from '../utils/tool_call_delta.js';

type ResponseInputItem = Record<string, any>;
type ResponseOutputItem = Record<string, any>;
type ResponseUsage = Record<string, any>;

async function formatResponsesHistory(messages: Message[]): Promise<ResponseInputItem[]> {
  const formattedMessages: ResponseInputItem[] = [];

  for (const msg of messages) {
    if (msg.image_urls.length || msg.audio_urls.length || msg.video_urls.length) {
      const contentParts: Record<string, any>[] = [];

      if (msg.content) {
        contentParts.push({ type: 'input_text', text: msg.content });
      }

      if (msg.image_urls.length) {
        const base64Results = await Promise.allSettled(
          msg.image_urls.map((url) => mediaSourceToBase64(url))
        );

        for (let index = 0; index < base64Results.length; index += 1) {
          const result = base64Results[index];
          const source = msg.image_urls[index];
          if (result.status !== 'fulfilled') {
            console.error(`Error processing image ${source}: ${result.reason}`);
            continue;
          }

          const hasLocalPath = source ? await isValidMediaPath(source) : false;
          const mimeType = hasLocalPath ? getMimeType(source) : 'image/jpeg';
          const dataUri = createDataUri(mimeType, result.value).image_url.url;
          contentParts.push({
            type: 'input_image',
            image_url: dataUri,
            detail: 'auto'
          });
        }
      }

      if (msg.audio_urls.length) {
        console.warn('OpenAI Responses input does not yet support audio; skipping.');
      }
      if (msg.video_urls.length) {
        console.warn('OpenAI Responses input does not yet support video; skipping.');
      }

      formattedMessages.push({
        type: 'message',
        role: msg.role,
        content: contentParts
      });
    } else {
      formattedMessages.push({
        type: 'message',
        role: msg.role,
        content: msg.content ?? ''
      });
    }
  }

  return formattedMessages;
}

export class OpenAIResponsesLLM extends BaseLLM {
  protected client: OpenAIClient;
  protected maxTokens: number | null;

  constructor(
    model: LLMModel,
    apiKeyEnvVar: string,
    baseUrl: string,
    llmConfig?: LLMConfig,
    apiKeyDefault?: string
  ) {
    const effectiveConfig = model.default_config ? model.default_config.clone() : new LLMConfig();
    if (llmConfig) {
      effectiveConfig.mergeWith(llmConfig);
    }

    let apiKey = process.env[apiKeyEnvVar];
    if ((!apiKey || apiKey === '') && apiKeyDefault) {
      apiKey = apiKeyDefault;
    }

    if (!apiKey) {
      throw new Error(`Missing API key. Set env var ${apiKeyEnvVar} or provide apiKeyDefault.`);
    }

    super(model, effectiveConfig);

    this.client = new OpenAIClient({ apiKey, baseURL: baseUrl });
    this.maxTokens = effectiveConfig.max_tokens ?? null;
  }

  private createTokenUsage(usageData?: ResponseUsage | null): TokenUsage | null {
    if (!usageData) return null;
    return {
      prompt_tokens: usageData.input_tokens ?? 0,
      completion_tokens: usageData.output_tokens ?? 0,
      total_tokens: usageData.total_tokens ?? 0
    };
  }

  private extractOutputContent(outputItems: ResponseOutputItem[]): { content: string; reasoning: string | null } {
    const contentChunks: string[] = [];
    const reasoningChunks: string[] = [];

    for (const item of outputItems ?? []) {
      const itemType = item?.type;
      if (itemType === 'message') {
        for (const part of item?.content ?? []) {
          if (part?.type === 'output_text') {
            contentChunks.push(part?.text ?? '');
          }
        }
      } else if (itemType === 'reasoning') {
        for (const summary of item?.summary ?? []) {
          if (summary?.type === 'summary_text') {
            reasoningChunks.push(summary?.text ?? '');
          }
        }
      }
    }

    const content = contentChunks.join('');
    const reasoning = reasoningChunks.length ? reasoningChunks.join('') : null;
    return { content, reasoning };
  }

  private buildReasoningParam(): Record<string, any> | null {
    if (!this.config.extra_params) return null;
    const reasoningEffort = this.config.extra_params.reasoning_effort;
    const reasoningSummary = this.config.extra_params.reasoning_summary;

    const reasoning: Record<string, any> = {};
    if (reasoningEffort) {
      reasoning.effort = reasoningEffort;
    }
    if (reasoningSummary && reasoningSummary !== 'none') {
      reasoning.summary = reasoningSummary;
    }

    return Object.keys(reasoning).length ? reasoning : null;
  }

  private filterExtraParams(): Record<string, any> {
    if (!this.config.extra_params) return {};
    const filtered = { ...this.config.extra_params };
    delete filtered.reasoning_effort;
    delete filtered.reasoning_summary;
    return filtered;
  }

  private normalizeTools(tools: Record<string, any>[]): Record<string, any>[] {
    return tools.map((tool) => {
      if (tool?.type === 'function' && typeof tool.function === 'object') {
        const fn = tool.function;
        return {
          type: 'function',
          name: fn.name,
          description: fn.description,
          parameters: fn.parameters
        };
      }
      return tool;
    });
  }

  protected async _sendUserMessageToLLM(
    userMessage: LLMUserMessage,
    kwargs: Record<string, any>
  ): Promise<CompleteResponse> {
    this.addUserMessage(userMessage);

    const formattedMessages = await formatResponsesHistory(this.messages);
    const params: Record<string, any> = {
      model: this.model.value,
      input: formattedMessages
    };

    if (this.maxTokens !== null) {
      params.max_output_tokens = this.maxTokens;
    }

    const reasoningParam = this.buildReasoningParam();
    if (reasoningParam) {
      params.reasoning = reasoningParam;
    }

    const extraParams = this.filterExtraParams();
    if (Object.keys(extraParams).length) {
      Object.assign(params, extraParams);
    }

    if (kwargs.tools) {
      params.tools = this.normalizeTools(kwargs.tools);
    }
    if (kwargs.tool_choice !== undefined) {
      params.tool_choice = kwargs.tool_choice;
    }

    try {
      const response: any = await this.client.responses.create(params as any);
      const { content, reasoning } = this.extractOutputContent(response.output ?? []);
      this.addAssistantMessage({ content, reasoning_content: reasoning ?? null });

      return new CompleteResponse({
        content,
        reasoning: reasoning ?? null,
        usage: this.createTokenUsage(response.usage)
      });
    } catch (error: any) {
      throw new Error(`Error in OPENAI Responses API request: ${error?.message ?? error}`);
    }
  }

  protected async *_streamUserMessageToLLM(
    userMessage: LLMUserMessage,
    kwargs: Record<string, any>
  ): AsyncGenerator<ChunkResponse, void, unknown> {
    this.addUserMessage(userMessage);

    const formattedMessages = await formatResponsesHistory(this.messages);
    const params: Record<string, any> = {
      model: this.model.value,
      input: formattedMessages,
      stream: true
    };

    if (this.maxTokens !== null) {
      params.max_output_tokens = this.maxTokens;
    }

    const reasoningParam = this.buildReasoningParam();
    if (reasoningParam) {
      params.reasoning = reasoningParam;
    }

    const extraParams = this.filterExtraParams();
    if (Object.keys(extraParams).length) {
      Object.assign(params, extraParams);
    }

    if (kwargs.tools) {
      params.tools = this.normalizeTools(kwargs.tools);
    }
    if (kwargs.tool_choice !== undefined) {
      params.tool_choice = kwargs.tool_choice;
    }

    const toolCallState = new Map<number, { call_id?: string; name?: string; args_seen: boolean; emitted: boolean }>();
    const textDeltaSeen = new Set<string>();
    const summaryDeltaSeen = new Set<string>();

    let accumulatedContent = '';
    let accumulatedReasoning = '';

    try {
      const stream = await this.client.responses.create(params as any) as unknown as AsyncIterable<ResponseStreamEvent>;

      for await (const event of stream) {
        const eventType = (event as any)?.type;

        if (eventType === 'response.output_text.delta') {
          textDeltaSeen.add((event as any).item_id);
          accumulatedContent += (event as any).delta ?? '';
          yield new ChunkResponse({ content: (event as any).delta ?? '', reasoning: null });
          continue;
        }

        if (eventType === 'response.output_text.done') {
          if (!textDeltaSeen.has((event as any).item_id)) {
            accumulatedContent += (event as any).text ?? '';
            yield new ChunkResponse({ content: (event as any).text ?? '', reasoning: null });
          }
          continue;
        }

        if (eventType === 'response.reasoning_summary_text.delta') {
          summaryDeltaSeen.add((event as any).item_id);
          accumulatedReasoning += (event as any).delta ?? '';
          yield new ChunkResponse({ content: '', reasoning: (event as any).delta ?? '' });
          continue;
        }

        if (eventType === 'response.reasoning_summary_text.done') {
          if (!summaryDeltaSeen.has((event as any).item_id)) {
            accumulatedReasoning += (event as any).text ?? '';
            yield new ChunkResponse({ content: '', reasoning: (event as any).text ?? '' });
          }
          continue;
        }

        if (eventType === 'response.output_item.added') {
          const item = (event as any).item;
          if (item?.type === 'function_call') {
            toolCallState.set((event as any).output_index, {
              call_id: item.call_id,
              name: item.name,
              args_seen: false,
              emitted: true
            });

            const toolCalls: ToolCallDelta[] = [{
              index: (event as any).output_index,
              call_id: item.call_id,
              name: item.name
            }];
            yield new ChunkResponse({ content: '', reasoning: null, tool_calls: toolCalls });
          }
          continue;
        }

        if (eventType === 'response.function_call_arguments.delta') {
          const state = toolCallState.get((event as any).output_index);
          if (state) {
            state.args_seen = true;
            const toolCalls: ToolCallDelta[] = [{
              index: (event as any).output_index,
              arguments_delta: (event as any).delta
            }];
            yield new ChunkResponse({ content: '', reasoning: null, tool_calls: toolCalls });
          }
          continue;
        }

        if (eventType === 'response.function_call_arguments.done') {
          const state = toolCallState.get((event as any).output_index);
          if (state && !state.args_seen) {
            const toolCalls: ToolCallDelta[] = [{
              index: (event as any).output_index,
              arguments_delta: (event as any).arguments
            }];
            yield new ChunkResponse({ content: '', reasoning: null, tool_calls: toolCalls });
            state.args_seen = true;
          }
          continue;
        }

        if (eventType === 'response.completed') {
          const response = (event as any).response;
          const outputItems = response?.output ?? [];

          for (let idx = 0; idx < outputItems.length; idx += 1) {
            const item = outputItems[idx];
            if (item?.type !== 'function_call') continue;

            let state = toolCallState.get(idx);
            if (!state || !state.emitted) {
              const toolCalls: ToolCallDelta[] = [{
                index: idx,
                call_id: item.call_id,
                name: item.name
              }];
              yield new ChunkResponse({ content: '', reasoning: null, tool_calls: toolCalls });
              toolCallState.set(idx, {
                call_id: item.call_id,
                name: item.name,
                args_seen: false,
                emitted: true
              });
              state = toolCallState.get(idx);
            }

            if (state && !state.args_seen) {
              const toolCalls: ToolCallDelta[] = [{
                index: idx,
                arguments_delta: item.arguments
              }];
              yield new ChunkResponse({ content: '', reasoning: null, tool_calls: toolCalls });
              state.args_seen = true;
            }
          }

          const tokenUsage = this.createTokenUsage(response?.usage ?? null);
          yield new ChunkResponse({ content: '', reasoning: null, is_complete: true, usage: tokenUsage });
          continue;
        }
      }

      this.addAssistantMessage({
        content: accumulatedContent,
        reasoning_content: accumulatedReasoning || null
      });
    } catch (error: any) {
      throw new Error(`Error in OPENAI Responses API streaming: ${error?.message ?? error}`);
    }
  }

  async cleanup(): Promise<void> {
    await super.cleanup();
  }
}
