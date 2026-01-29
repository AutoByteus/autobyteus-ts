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

const splitGeminiParts = (parts: Array<Record<string, any>> = []): { content: string; reasoning: string } => {
  let content = '';
  let reasoning = '';
  for (const part of parts) {
    const text = part?.text;
    if (!text) {
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
        canonical_name: 'gemini-3-flash',
        provider: LLMProvider.GEMINI
      });

    const config = llmConfig ?? new LLMConfig();
    super(effectiveModel, config);

    const init = initializeGeminiClientWithRuntime();
    this.client = init.client;
    this.runtimeInfo = init.runtimeInfo;
  }

  private async formatGeminiHistory(messages: Message[]): Promise<Array<Record<string, any>>> {
    const history: Array<Record<string, any>> = [];

    for (const msg of messages) {
      if (msg.role !== MessageRole.USER && msg.role !== MessageRole.ASSISTANT) {
        continue;
      }

      const role = msg.role === MessageRole.ASSISTANT ? 'model' : 'user';
      const parts: Array<Record<string, any>> = [];

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

  private buildGenerationConfig(tools?: any[]): Record<string, any> {
    const extraParams = { ...(this.config.extra_params ?? {}) };
    const thinkingLevel = extraParams.thinking_level ?? 'minimal';
    const includeThoughts = Boolean(extraParams.include_thoughts ?? false);
    delete extraParams.thinking_level;
    delete extraParams.include_thoughts;

    const config: Record<string, any> = {
      responseMimeType: 'text/plain',
      systemInstruction: this.systemMessage,
      temperature: this.config.temperature,
      topP: this.config.top_p ?? undefined,
      maxOutputTokens: this.config.max_tokens ?? undefined,
      stopSequences: this.config.stop_sequences ?? undefined,
      presencePenalty: this.config.presence_penalty ?? undefined,
      frequencyPenalty: this.config.frequency_penalty ?? undefined
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

  private normalizeGeminiTools(tools?: any[]): any[] | undefined {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    if (!Array.isArray(tools)) {
      const toolObj = tools as any;
      if (toolObj?.function_declarations && !toolObj.functionDeclarations) {
        return [{ functionDeclarations: toolObj.function_declarations }];
      }
      if (toolObj?.functionDeclarations) {
        return [toolObj];
      }
      return [{ functionDeclarations: [toolObj] }];
    }

    const first = tools[0];
    if (first && typeof first === 'object') {
      if ('functionDeclarations' in first) {
        return tools;
      }
      if ('function_declarations' in first) {
        return tools.map((tool: any) => {
          if (tool?.function_declarations && !tool.functionDeclarations) {
            return { functionDeclarations: tool.function_declarations };
          }
          return tool;
        });
      }
    }

    if (first && typeof first === 'object' && 'name' in first && 'description' in first) {
      return [{ functionDeclarations: tools }];
    }

    return tools;
  }

  private toTokenUsage(usage: any): TokenUsage | null {
    if (!usage) {
      return null;
    }
    const prompt = usage.promptTokenCount ?? 0;
    const completion = usage.candidatesTokenCount ?? 0;
    const total = usage.totalTokenCount ?? prompt + completion;
    return {
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: total
    };
  }

  protected async _sendUserMessageToLLM(userMessage: LLMUserMessage, kwargs: Record<string, any>): Promise<CompleteResponse> {
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
      const split = splitGeminiParts(parts as Array<Record<string, any>>);
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

  protected async *_streamUserMessageToLLM(userMessage: LLMUserMessage, kwargs: Record<string, any>): AsyncGenerator<ChunkResponse, void, unknown> {
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
