import { GoogleGenAI } from '@google/genai';
import { BaseLLM } from '../base.js';
import { LLMModel } from '../models.js';
import { LLMProvider } from '../providers.js';
import { LLMConfig } from '../utils/llm_config.js';
import { LLMUserMessage } from '../user_message.js';
import { CompleteResponse, ChunkResponse } from '../utils/response_types.js';
import { Message, MessageRole } from '../utils/messages.js';
import { TokenUsage } from '../utils/token_usage.js';
import { initializeGeminiClientWithRuntime } from '../../utils/gemini_helper.js';
import { resolveModelForRuntime } from '../../utils/gemini_model_mapping.js';
import { mediaSourceToBase64, getMimeType } from '../utils/media_payload_formatter.js';
import { convertGeminiToolCalls } from '../converters/gemini_tool_call_converter.js';

const THINKING_LEVEL_BUDGETS: Record<string, number> = {
  minimal: 0,
  low: 1024,
  medium: 4096,
  high: 16384
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const splitGeminiParts = (parts: Array<Record<string, unknown>> = []): { content: string; reasoning: string } => {
  let content = '';
  let reasoning = '';
  for (const part of parts) {
    const text = part?.text;
    if (typeof text !== 'string' || text.length === 0) {
      continue;
    }
    if (part?.thought) {
      reasoning += text;
    } else {
      content += text;
    }
  }
  return { content, reasoning };
};

export class GeminiLLM extends BaseLLM {
  private client: GoogleGenAI;
  private runtimeInfo: { runtime: string; project: string | null; location: string | null } | null = null;

  constructor(model?: LLMModel, llmConfig?: LLMConfig) {
    const effectiveModel =
      model ??
      new LLMModel({
        name: 'gemini-3-flash-preview',
        value: 'gemini-3-flash-preview',
        canonicalName: 'gemini-3-flash',
        provider: LLMProvider.GEMINI
      });

    const config = llmConfig ?? new LLMConfig();
    super(effectiveModel, config);

    const init = initializeGeminiClientWithRuntime();
    this.client = init.client;
    this.runtimeInfo = init.runtimeInfo;
  }

  private async formatGeminiHistory(messages: Message[]): Promise<Array<Record<string, unknown>>> {
    const history: Array<Record<string, unknown>> = [];

    for (const msg of messages) {
      if (msg.role !== MessageRole.USER && msg.role !== MessageRole.ASSISTANT) {
        continue;
      }

      const role = msg.role === MessageRole.ASSISTANT ? 'model' : 'user';
      const parts: Array<Record<string, unknown>> = [];

      if (msg.content) {
        parts.push({ text: msg.content });
      }

      const mediaUrls = [...msg.image_urls, ...msg.audio_urls, ...msg.video_urls];
      for (const url of mediaUrls) {
        try {
          const b64 = await mediaSourceToBase64(url);
          const mimeType = getMimeType(url);
          parts.push({ inlineData: { data: b64, mimeType } });
        } catch (error) {
          console.error(`Failed to process Gemini media ${url}: ${error}`);
        }
      }

      if (parts.length) {
        history.push({ role, parts });
      }
    }

    return history;
  }

  private buildGenerationConfig(tools?: Array<Record<string, unknown>>): Record<string, unknown> {
    const extraParams = { ...(this.config.extraParams ?? {}) };
    const thinkingLevel = extraParams.thinking_level ?? 'minimal';
    const includeThoughts = Boolean(extraParams.include_thoughts ?? false);
    delete extraParams.thinking_level;
    delete extraParams.include_thoughts;

    const config: Record<string, unknown> = {
      responseMimeType: 'text/plain',
      systemInstruction: this.systemMessage,
      temperature: this.config.temperature,
      topP: this.config.topP ?? undefined,
      maxOutputTokens: this.config.maxTokens ?? undefined,
      stopSequences: this.config.stopSequences ?? undefined,
      presencePenalty: this.config.presencePenalty ?? undefined,
      frequencyPenalty: this.config.frequencyPenalty ?? undefined
    };

    const budget = THINKING_LEVEL_BUDGETS[String(thinkingLevel)] ?? 0;
    if (budget || includeThoughts) {
      config.thinkingConfig = {
        thinkingBudget: budget,
        includeThoughts
      };
    }

    if (tools && tools.length > 0) {
      config.tools = tools;
    }

    if (Object.keys(extraParams).length) {
      Object.assign(config, extraParams);
    }

    return config;
  }

  private normalizeGeminiTools(tools: unknown): Array<Record<string, unknown>> | undefined {
    if (!tools) {
      return undefined;
    }

    if (!Array.isArray(tools)) {
      if (!isRecord(tools)) {
        return undefined;
      }
      if ('function_declarations' in tools && !('functionDeclarations' in tools)) {
        return [{ functionDeclarations: tools.function_declarations as unknown }];
      }
      if ('functionDeclarations' in tools) {
        return [tools as Record<string, unknown>];
      }
      return [{ functionDeclarations: [tools] }];
    }

    const first = tools[0];
    if (isRecord(first)) {
      if ('functionDeclarations' in first) {
        return tools;
      }
      if ('function_declarations' in first) {
        return tools.map((tool) => {
          if (isRecord(tool) && 'function_declarations' in tool && !('functionDeclarations' in tool)) {
            return { functionDeclarations: tool.function_declarations as unknown };
          }
          return tool as Record<string, unknown>;
        });
      }
    }

    if (isRecord(first) && 'name' in first && 'description' in first) {
      return [{ functionDeclarations: tools as Array<Record<string, unknown>> }];
    }

    return tools as Array<Record<string, unknown>>;
  }

  private toTokenUsage(usage: unknown): TokenUsage | null {
    if (!isRecord(usage)) {
      return null;
    }
    const prompt = typeof usage.promptTokenCount === 'number' ? usage.promptTokenCount : 0;
    const completion = typeof usage.candidatesTokenCount === 'number' ? usage.candidatesTokenCount : 0;
    const total =
      typeof usage.totalTokenCount === 'number'
        ? usage.totalTokenCount
        : prompt + completion;
    return {
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: total
    };
  }

  protected async _sendUserMessageToLLM(userMessage: LLMUserMessage, kwargs: Record<string, unknown>): Promise<CompleteResponse> {
    this.addUserMessage(userMessage);

    const history = await this.formatGeminiHistory(this.messages);
    const runtimeAdjustedModel = resolveModelForRuntime(
      this.model.value,
      'llm',
      this.runtimeInfo?.runtime ?? null
    );

    const tools = this.normalizeGeminiTools(kwargs.tools);
    const config = this.buildGenerationConfig(tools);

    const response = await this.client.models.generateContent({
      model: runtimeAdjustedModel,
      contents: history,
      config
    });

    let content = response.text ?? '';
    let reasoning: string | null = null;

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    if (parts.length) {
      const split = splitGeminiParts(parts as Array<Record<string, unknown>>);
      content = split.content || content;
      reasoning = split.reasoning || null;
    }

    this.addAssistantMessage({ content, reasoning_content: reasoning ?? null });

    return new CompleteResponse({
      content,
      reasoning: reasoning ?? null,
      usage: this.toTokenUsage(response.usageMetadata ?? null)
    });
  }

  protected async *_streamUserMessageToLLM(userMessage: LLMUserMessage, kwargs: Record<string, unknown>): AsyncGenerator<ChunkResponse, void, unknown> {
    this.addUserMessage(userMessage);

    const history = await this.formatGeminiHistory(this.messages);
    const runtimeAdjustedModel = resolveModelForRuntime(
      this.model.value,
      'llm',
      this.runtimeInfo?.runtime ?? null
    );

    const tools = this.normalizeGeminiTools(kwargs.tools);
    const config = this.buildGenerationConfig(tools);

    const stream = await this.client.models.generateContentStream({
      model: runtimeAdjustedModel,
      contents: history,
      config
    });

    let accumulatedContent = '';
    let accumulatedReasoning = '';

    for await (const chunk of stream) {
      let handledParts = false;
      const parts = chunk.candidates?.[0]?.content?.parts ?? [];
      if (parts.length) {
        handledParts = true;
        for (const part of parts) {
          const partText = (part as any)?.text;
          if (partText) {
            if ((part as any)?.thought) {
              accumulatedReasoning += partText;
              yield new ChunkResponse({ content: '', reasoning: partText, is_complete: false });
            } else {
              accumulatedContent += partText;
              yield new ChunkResponse({ content: partText, is_complete: false });
            }
          }

          const toolCalls = convertGeminiToolCalls(part);
          if (toolCalls) {
            yield new ChunkResponse({ content: '', tool_calls: toolCalls, is_complete: false });
          }
        }
      }

      if (!handledParts && chunk.text) {
        accumulatedContent += chunk.text;
        yield new ChunkResponse({ content: chunk.text, is_complete: false });
      }

      if (chunk.usageMetadata) {
        yield new ChunkResponse({
          content: '',
          is_complete: true,
          usage: this.toTokenUsage(chunk.usageMetadata)
        });
      }
    }

    this.addAssistantMessage({ content: accumulatedContent, reasoning_content: accumulatedReasoning || null });
  }

  async cleanup(): Promise<void> {
    await super.cleanup();
  }
}
