import Anthropic from '@anthropic-ai/sdk';
import { BaseLLM } from '../base.js';
import { LLMModel } from '../models.js';
import { LLMConfig } from '../utils/llm_config.js';
import { LLMUserMessage } from '../user_message.js';
import { CompleteResponse, ChunkResponse } from '../utils/response_types.js';
import { TokenUsage } from '../utils/token_usage.js';
import { Message, MessageRole } from '../utils/messages.js';
import { mediaSourceToBase64, getMimeType } from '../utils/media_payload_formatter.js';
import { convertAnthropicToolCall } from '../converters/anthropic_tool_call_converter.js';

export class AnthropicLLM extends BaseLLM {
  protected client: Anthropic;
  protected maxTokens: number;

  constructor(model: LLMModel, llmConfig?: LLMConfig) {
    if (!llmConfig) {
      llmConfig = new LLMConfig();
    }
    
    super(model, llmConfig);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set.");
    }

    this.client = new Anthropic({ apiKey });
    this.maxTokens = llmConfig.max_tokens ?? 8192;
  }

  private async formatAnthropicMessages(): Promise<Anthropic.MessageParam[]> {
    const formattedMessages: Anthropic.MessageParam[] = [];

    for (const msg of this.messages) {
      if (msg.role === MessageRole.SYSTEM) continue; // System handled separately

      if (msg.image_urls && msg.image_urls.length > 0) {
        const contentBlocks: Anthropic.ContentBlockParam[] = [];
        
        for (const url of msg.image_urls) {
           try {
             const b64 = await mediaSourceToBase64(url);
             let mimeType = getMimeType(url);
             const validImageMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
             if (!validImageMimes.includes(mimeType)) {
               console.warn(
                 `Unsupported image MIME type '${mimeType}' for ${url}. ` +
                 `Anthropic supports: ${validImageMimes.join(', ')}. Defaulting to image/jpeg.`
               );
               mimeType = 'image/jpeg';
             }
             contentBlocks.push({
               type: 'image',
               source: {
                 type: 'base64',
                 media_type: mimeType as any,
                 data: b64
               }
             });
           } catch (error) {
             console.error(`Error processing image ${url}: ${error}`);
             continue;
           }
        }

        if (msg.content) {
          contentBlocks.push({ type: 'text', text: msg.content });
        }
        
        formattedMessages.push({
          role: msg.role === MessageRole.USER ? 'user' : 'assistant',
          content: contentBlocks
        });

      } else {
        formattedMessages.push({
          role: msg.role === MessageRole.USER ? 'user' : 'assistant',
          content: msg.content || ""
        });
      }
    }
    return formattedMessages;
  }

  protected async _sendUserMessageToLLM(userMessage: LLMUserMessage, kwargs: Record<string, any>): Promise<CompleteResponse> {
    this.addUserMessage(userMessage);

    const messages = await this.formatAnthropicMessages();
    
    const params: Anthropic.MessageCreateParams = {
      model: this.model.value,
      max_tokens: this.maxTokens,
      system: this.systemMessage,
      messages: messages,
      ...kwargs
    };

    if (this.config.extra_params) {
       Object.assign(params, this.config.extra_params);
       // Handle thinking/budget if ported
    }

    try {
      const response = await this.client.messages.create(params);
      
      let content = "";
      if (response.content) {
        // Extract text blocks
        content = response.content
          .filter(b => b.type === 'text')
          .map(b => (b as Anthropic.TextBlock).text)
          .join('');
      }

      this.addAssistantMessage({ content });

      return new CompleteResponse({
        content,
        usage: {
          prompt_tokens: response.usage.input_tokens,
          completion_tokens: response.usage.output_tokens,
          total_tokens: response.usage.input_tokens + response.usage.output_tokens
        }
      });
    } catch (e) {
      throw new Error(`Error in Anthropic API: ${e}`);
    }
  }

  protected async *_streamUserMessageToLLM(userMessage: LLMUserMessage, kwargs: Record<string, any>): AsyncGenerator<ChunkResponse, void, unknown> {
    this.addUserMessage(userMessage);

    const messages = await this.formatAnthropicMessages();
    const params: any = {
      model: this.model.value,
      max_tokens: this.maxTokens,
      system: this.systemMessage,
      messages: messages,
      stream: true,
      ...kwargs
    };
    
    // Tools handling omitted for brevity, similar to Python
    if (kwargs.tools) params.tools = kwargs.tools;

    try {
      const stream = await this.client.messages.create(params) as any as AsyncIterable<Anthropic.MessageStreamEvent>;
      
      let accumulatedContent = "";

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          accumulatedContent += event.delta.text;
          yield new ChunkResponse({ content: event.delta.text });
        }
        
        const toolDeltas = convertAnthropicToolCall(event);
        if (toolDeltas) {
           yield new ChunkResponse({ content: "", tool_calls: toolDeltas });
        }
        
        if (event.type === 'message_stop') {
           // Usage not always in stop event? 
           // In SDK stream, usage comes in message_delta maybe?
        }
        
        // Handling usage in stream for Anthropic is slightly different (MessageDeltaEvent with usage)
        if (event.type === 'message_delta' && event.usage) {
           yield new ChunkResponse({
             content: "", is_complete: true,
             usage: {
               prompt_tokens: 0, // Not provided in delta usually? Start event has input tokens?
               completion_tokens: event.usage.output_tokens,
               total_tokens: event.usage.output_tokens 
             }
           });
        }
      }
      
      this.addAssistantMessage({ content: accumulatedContent });

    } catch (e) {
      throw new Error(`Error in Anthropic streaming: ${e}`);
    }
  }
}
