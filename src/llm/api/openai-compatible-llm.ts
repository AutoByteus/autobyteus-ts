import type { OpenAI } from 'openai';
import { BaseLLM } from '../base.js';
import { LLMModel } from '../models.js';
import { LLMConfig } from '../utils/llm-config.js';
import { LLMUserMessage } from '../user-message.js';
import { CompleteResponse, ChunkResponse } from '../utils/response-types.js';
import { TokenUsage } from '../utils/token-usage.js';
import { Message, MessageRole } from '../utils/messages.js';
import { mediaSourceToBase64, createDataUri, getMimeType, isValidMediaPath } from '../utils/media-payload-formatter.js';
import { convertOpenAIToolCalls } from '../converters/openai-tool-call-converter.js';

// We need to inject the OpenAI client implementation or factory.
// Python implementation constructs `OpenAI` client inside. 
// We should use the official `openai` Node SDK.
import { OpenAI as OpenAIClient } from 'openai';
import { ChatCompletionChunk } from 'openai/resources/chat/completions.mjs';

/**
 * Format history for OpenAI SDK, handling image processing.
 */
async function formatOpenAIHistory(messages: Message[]): Promise<OpenAIClient.Chat.ChatCompletionMessageParam[]> {
  const formattedMessages: OpenAIClient.Chat.ChatCompletionMessageParam[] = [];

  for (const msg of messages) {
    if (msg.image_urls && msg.image_urls.length > 0) {
      const contentParts: OpenAIClient.Chat.ChatCompletionContentPart[] = [];
      
      if (msg.content) {
        contentParts.push({ type: "text", text: msg.content });
      }

      for (const url of msg.image_urls) {
        try {
          const b64 = await mediaSourceToBase64(url);
          // Simplified MIME detection logic similar to python
          // In real app, might want better detection from buffer if possible.
          let mimeType = "image/jpeg";
          if (await isValidMediaPath(url)) {
             mimeType = getMimeType(url);
          }
          const dataUri = createDataUri(mimeType, b64);
          contentParts.push(dataUri as any); // Type assertion if SDK types are strict
        } catch (e) {
          console.error(`Error processing image ${url}: ${e}`);
        }
      }
      
      formattedMessages.push({
        role: msg.role as any, // Cast role to match specific string literals
        content: contentParts
      });
    } else {
      formattedMessages.push({
        role: msg.role as any,
        content: msg.content || ""
      });
    }
  }
  return formattedMessages;
}

export class OpenAICompatibleLLM extends BaseLLM {
  protected client: OpenAIClient;
  protected maxTokens?: number;

  constructor(
    model: LLMModel,
    apiKeyEnvVar: string,
    baseUrl: string,
    llmConfig?: LLMConfig,
    apiKeyDefault?: string
  ) {
    let effectiveConfig = model.defaultConfig ? model.defaultConfig.clone() : new LLMConfig();
    if (llmConfig) {
      effectiveConfig.mergeWith(llmConfig);
    }
    
    // Pass to super
    super(model, effectiveConfig);

    let apiKey = process.env[apiKeyEnvVar];
    if ((!apiKey || apiKey === "") && apiKeyDefault) {
       apiKey = apiKeyDefault;
    }

    if (!apiKey) {
      throw new Error(`${apiKeyEnvVar} environment variable is not set.`);
    }

    this.client = new OpenAIClient({
      apiKey: apiKey,
      baseURL: baseUrl
    });
    
    this.maxTokens = effectiveConfig.maxTokens ?? undefined;
  }

  private createTokenUsage(usageData?: OpenAIClient.CompletionUsage): TokenUsage | null {
    if (!usageData) return null;
    return {
      prompt_tokens: usageData.prompt_tokens,
      completion_tokens: usageData.completion_tokens,
      total_tokens: usageData.total_tokens
    };
  }

  protected async _sendUserMessageToLLM(userMessage: LLMUserMessage, kwargs: Record<string, unknown>): Promise<CompleteResponse> {
    this.addUserMessage(userMessage);

    const formattedMessages = await formatOpenAIHistory(this.messages);
    
    const params: OpenAIClient.Chat.ChatCompletionCreateParams = {
      model: this.model.value,
      messages: formattedMessages,
      ...kwargs
    };

    if (this.maxTokens) {
      // Mapping legacy max_tokens behavior if needed, or stick to max_tokens (deprecated?) or max_completion_tokens
      params.max_tokens = this.maxTokens; 
    }
    
    // extra params handling
    if (this.config.extraParams) {
       Object.assign(params, this.config.extraParams);
    }

    try {
      const response = await this.client.chat.completions.create(params as any); // Cast for extra params flexibility
      const choice = response.choices[0];
      const message = choice.message;
      
      const content = message.content || "";
      // const reasoning = message.reasoning_content; // If supported by custom provider extensions

      this.addAssistantMessage({ content });

      return new CompleteResponse({
        content,
        usage: this.createTokenUsage(response.usage),
        // reasoning
      });
    } catch (e) {
      throw new Error(`Error in API request: ${e}`);
    }
  }

  protected async *_streamUserMessageToLLM(userMessage: LLMUserMessage, kwargs: Record<string, unknown>): AsyncGenerator<ChunkResponse, void, unknown> {
    this.addUserMessage(userMessage);

    const formattedMessages = await formatOpenAIHistory(this.messages);
    const params: any = {
      model: this.model.value,
      messages: formattedMessages,
      stream: true,
      stream_options: { include_usage: true },
      ...kwargs
    };

    if (this.maxTokens) params.max_tokens = this.maxTokens;
    if (this.config.extraParams) Object.assign(params, this.config.extraParams);

    if (kwargs.tools) params.tools = kwargs.tools;

    try {
      const stream = await this.client.chat.completions.create(params) as unknown as AsyncIterable<ChatCompletionChunk>;
      
      let accumulatedContent = "";
      
      for await (const chunk of stream) {
        if (chunk.choices && chunk.choices.length > 0) {
           const delta = chunk.choices[0].delta;
           
           // Handle content
           if (delta.content) {
             accumulatedContent += delta.content;
             yield new ChunkResponse({ content: delta.content });
           }

           // Handle tool calls
           if (delta.tool_calls) {
             const toolDeltas = convertOpenAIToolCalls(delta.tool_calls as any);
             if (toolDeltas) {
               yield new ChunkResponse({ content: "", tool_calls: toolDeltas });
             }
           }
        }

        if (chunk.usage) {
           yield new ChunkResponse({ 
             content: "", is_complete: true, usage: this.createTokenUsage(chunk.usage) 
           });
        }
      }

      this.addAssistantMessage({ content: accumulatedContent });

    } catch (e) {
      throw new Error(`Error in API streaming: ${e}`);
    }
  }
}
