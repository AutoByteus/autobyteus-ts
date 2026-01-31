import { LLMModel } from './models.js';
import { LLMConfig } from './utils/llm-config.js';
import { ExtensionRegistry } from './extensions/extension-registry.js';
import { TokenUsageTrackingExtension } from './extensions/token-usage-tracking-extension.js';
import { LLMExtension } from './extensions/base-extension.js';
import { Message, MessageRole } from './utils/messages.js';
import { LLMUserMessage } from './user-message.js';
import { CompleteResponse, ChunkResponse } from './utils/response-types.js';
import { TokenUsage } from './utils/token-usage.js';

export abstract class BaseLLM {
  public static DEFAULT_SYSTEM_MESSAGE = "You are a helpful assistant";
  
  public model: LLMModel;
  public config: LLMConfig;
  protected extensionRegistry: ExtensionRegistry;
  protected tokenUsageExtension: TokenUsageTrackingExtension;
  public messages: Message[] = [];
  public systemMessage: string;

  constructor(model: LLMModel, llmConfig: LLMConfig) {
    // Validation handled by types usually, but we can recurse logic.
    this.model = model;
    this.config = llmConfig;
    this.extensionRegistry = new ExtensionRegistry();
    
    // Auto-register token usage
    this.tokenUsageExtension = new TokenUsageTrackingExtension(this);
    this.registerExtension(this.tokenUsageExtension);

    this.systemMessage = this.config.systemMessage || BaseLLM.DEFAULT_SYSTEM_MESSAGE;
    this.addSystemMessage(this.systemMessage);
  }

  get latestTokenUsage(): TokenUsage | null {
    return this.tokenUsageExtension.getLatestUsage();
  }

  registerExtension(extension: LLMExtension): LLMExtension {
    this.extensionRegistry.register(extension);
    return extension;
  }

  unregisterExtension(extension: LLMExtension): void {
    this.extensionRegistry.unregister(extension);
  }

  getExtension<T extends LLMExtension>(extensionClass: { new(...args: unknown[]): T }): T | null {
    return this.extensionRegistry.get(extensionClass);
  }

  addSystemMessage(message: string): void {
    this.messages.push(new Message(MessageRole.SYSTEM, message));
  }

  addUserMessage(userMessage: LLMUserMessage): void {
    const msg = new Message(MessageRole.USER, {
      content: userMessage.content,
      image_urls: userMessage.image_urls,
      audio_urls: userMessage.audio_urls,
      video_urls: userMessage.video_urls
    });
    this.messages.push(msg);
    this.triggerOnUserMessageAdded(msg);
  }

  addAssistantMessage(options: {
    content?: string | null;
    reasoning_content?: string | null;
    image_urls?: string[];
    audio_urls?: string[];
    video_urls?: string[];
  }): void {
    const msg = new Message(MessageRole.ASSISTANT, options);
    this.messages.push(msg);
    this.triggerOnAssistantMessageAdded(msg);
  }

  configureSystemPrompt(newSystemPrompt: string): void {
    if (!newSystemPrompt) return; // Warning log

    this.systemMessage = newSystemPrompt;
    this.config.systemMessage = newSystemPrompt;

    let systemMessageFound = false;
    for (let i = 0; i < this.messages.length; i++) {
       if (this.messages[i].role === MessageRole.SYSTEM) {
         this.messages[i] = new Message(MessageRole.SYSTEM, newSystemPrompt);
         systemMessageFound = true;
         // In python it breaks after first system usage replacement?
         break;
       }
    }

    if (!systemMessageFound) {
      this.messages.unshift(new Message(MessageRole.SYSTEM, newSystemPrompt));
    }
  }

  private triggerOnUserMessageAdded(message: Message): void {
    this.extensionRegistry.getAll().forEach(ext => ext.onUserMessageAdded(message));
  }

  private triggerOnAssistantMessageAdded(message: Message): void {
    this.extensionRegistry.getAll().forEach(ext => ext.onAssistantMessageAdded(message));
  }

  protected async executeBeforeHooks(userMessage: LLMUserMessage, kwargs: Record<string, unknown>): Promise<void> {
    for (const ext of this.extensionRegistry.getAll()) {
      await ext.beforeInvoke(userMessage, kwargs);
    }
  }

  protected async executeAfterHooks(userMessage: LLMUserMessage, response: CompleteResponse | null, kwargs: Record<string, unknown>): Promise<void> {
    for (const ext of this.extensionRegistry.getAll()) {
      await ext.afterInvoke(userMessage, response, kwargs);
    }
  }

  async sendUserMessage(userMessage: LLMUserMessage, kwargs: Record<string, unknown> = {}): Promise<CompleteResponse> {
    await this.executeBeforeHooks(userMessage, kwargs);
    const response = await this._sendUserMessageToLLM(userMessage, kwargs);
    await this.executeAfterHooks(userMessage, response, kwargs);
    return response;
  }

  async *streamUserMessage(userMessage: LLMUserMessage, kwargs: Record<string, unknown> = {}): AsyncGenerator<ChunkResponse, void, unknown> {
    await this.executeBeforeHooks(userMessage, kwargs);

    let accumulatedContent = "";
    let accumulatedReasoning = "";
    let finalChunk: ChunkResponse | null = null;

    for await (const chunk of this._streamUserMessageToLLM(userMessage, kwargs)) {
      if (chunk.content) accumulatedContent += chunk.content;
      if (chunk.reasoning) accumulatedReasoning += chunk.reasoning;
      
      if (chunk.is_complete) finalChunk = chunk;
      
      yield chunk;
    }

    const completeResponse = new CompleteResponse({
      content: accumulatedContent,
      reasoning: accumulatedReasoning || null,
      usage: finalChunk?.usage
    });

    await this.executeAfterHooks(userMessage, completeResponse, kwargs);
  }

  protected abstract _sendUserMessageToLLM(userMessage: LLMUserMessage, kwargs: Record<string, unknown>): Promise<CompleteResponse>;

  protected abstract _streamUserMessageToLLM(userMessage: LLMUserMessage, kwargs: Record<string, unknown>): AsyncGenerator<ChunkResponse, void, unknown>;

  async cleanup(): Promise<void> {
    for (const ext of this.extensionRegistry.getAll()) {
      await ext.cleanup();
    }
    this.extensionRegistry.clear();
    this.messages = [];
  }
}
