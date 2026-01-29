import { BaseLLM } from './base.js';
import { LLMModel, ModelInfo } from './models.js';
import { LLMProvider } from './providers.js';
import { LLMRuntime } from './runtimes.js';
import { LLMConfig, TokenPricingConfig } from './utils/llm_config.js';
import { ParameterSchema, ParameterDefinition, ParameterType } from '../utils/parameter_schema.js';

import { OpenAILLM } from './api/openai_llm.js';
import { AnthropicLLM } from './api/anthropic_llm.js';
import { MistralLLM } from './api/mistral_llm.js';
import { GrokLLM } from './api/grok_llm.js';
import { DeepSeekLLM } from './api/deepseek_llm.js';
import { GeminiLLM } from './api/gemini_llm.js';
import { KimiLLM } from './api/kimi_llm.js';
import { QwenLLM } from './api/qwen_llm.js';
import { ZhipuLLM } from './api/zhipu_llm.js';
import { MinimaxLLM } from './api/minimax_llm.js';

import { OllamaModelProvider } from './ollama_provider.js';
import { LMStudioModelProvider } from './lmstudio_provider.js';
import { AutobyteusModelProvider } from './autobyteus_provider.js';

const pricing = (input: number, output: number) =>
  new TokenPricingConfig({ input_token_pricing: input, output_token_pricing: output });

const openaiReasoningSchema = new ParameterSchema([
  new ParameterDefinition({
    name: 'reasoning_effort',
    type: ParameterType.ENUM,
    description: 'Controls how hard the model thinks. Higher effort improves quality but can increase latency and cost.',
    required: false,
    defaultValue: 'none',
    enumValues: ['none', 'low', 'medium', 'high', 'xhigh']
  }),
  new ParameterDefinition({
    name: 'reasoning_summary',
    type: ParameterType.ENUM,
    description: 'Include a reasoning summary in the response when supported.',
    required: false,
    defaultValue: 'none',
    enumValues: ['none', 'auto', 'concise', 'detailed']
  })
]);

const claudeSchema = new ParameterSchema([
  new ParameterDefinition({
    name: 'thinking_enabled',
    type: ParameterType.BOOLEAN,
    description: 'Enable extended thinking summaries in Claude responses',
    required: false,
    defaultValue: false
  }),
  new ParameterDefinition({
    name: 'thinking_budget_tokens',
    type: ParameterType.INTEGER,
    description: 'Token budget for extended thinking (min 1024)',
    required: false,
    defaultValue: 1024,
    minValue: 1024
  })
]);

const geminiSchema = new ParameterSchema([
  new ParameterDefinition({
    name: 'thinking_level',
    type: ParameterType.ENUM,
    description: 'How deeply the model should reason before responding',
    required: false,
    defaultValue: 'minimal',
    enumValues: ['minimal', 'low', 'medium', 'high']
  }),
  new ParameterDefinition({
    name: 'include_thoughts',
    type: ParameterType.BOOLEAN,
    description: 'Include model thought summaries in responses',
    required: false,
    defaultValue: false
  })
]);

const zhipuSchema = new ParameterSchema([
  new ParameterDefinition({
    name: 'thinking_type',
    type: ParameterType.ENUM,
    description: 'Enable or disable deep thinking',
    required: false,
    defaultValue: 'enabled',
    enumValues: ['enabled', 'disabled']
  })
]);

export class LLMFactory {
  private static modelsByProvider = new Map<LLMProvider, LLMModel[]>();
  private static modelsByIdentifier = new Map<string, LLMModel>();
  private static initialized = false;

  static async ensureInitialized(): Promise<void> {
    if (!LLMFactory.initialized) {
      await LLMFactory.initializeRegistry();
      LLMFactory.initialized = true;
    }
  }

  static async reinitialize(): Promise<void> {
    LLMFactory.initialized = false;
    LLMFactory.modelsByProvider.clear();
    LLMFactory.modelsByIdentifier.clear();
    await LLMFactory.ensureInitialized();
  }

  private static async initializeRegistry(): Promise<void> {
    const supportedModels: LLMModel[] = [
      new LLMModel({
        name: 'gpt-5.2',
        value: 'gpt-5.2',
        provider: LLMProvider.OPENAI,
        llm_class: OpenAILLM,
        canonical_name: 'gpt-5.2',
        default_config: new LLMConfig({ pricing_config: pricing(1.75, 14.0) }),
        config_schema: openaiReasoningSchema
      }),
      new LLMModel({
        name: 'gpt-5.2-chat-latest',
        value: 'gpt-5.2-chat-latest',
        provider: LLMProvider.OPENAI,
        llm_class: OpenAILLM,
        canonical_name: 'gpt-5.2-chat-latest',
        default_config: new LLMConfig({ pricing_config: pricing(1.75, 14.0) }),
        config_schema: openaiReasoningSchema
      }),
      new LLMModel({
        name: 'mistral-large',
        value: 'mistral-large-latest',
        provider: LLMProvider.MISTRAL,
        llm_class: MistralLLM,
        canonical_name: 'mistral-large',
        default_config: new LLMConfig({ pricing_config: pricing(2.0, 6.0) })
      }),
      new LLMModel({
        name: 'devstral-2',
        value: 'devstral-2512',
        provider: LLMProvider.MISTRAL,
        llm_class: MistralLLM,
        canonical_name: 'devstral-2',
        default_config: new LLMConfig({ pricing_config: pricing(0.4, 2.0) })
      }),
      new LLMModel({
        name: 'grok-4',
        value: 'grok-4',
        provider: LLMProvider.GROK,
        llm_class: GrokLLM,
        canonical_name: 'grok-4',
        default_config: new LLMConfig({ pricing_config: pricing(3.0, 15.0) })
      }),
      new LLMModel({
        name: 'grok-4-1-fast-reasoning',
        value: 'grok-4-1-fast-reasoning',
        provider: LLMProvider.GROK,
        llm_class: GrokLLM,
        canonical_name: 'grok-4-1-fast-reasoning',
        default_config: new LLMConfig({ pricing_config: pricing(0.2, 0.5) })
      }),
      new LLMModel({
        name: 'grok-4-1-fast-non-reasoning',
        value: 'grok-4-1-fast-non-reasoning',
        provider: LLMProvider.GROK,
        llm_class: GrokLLM,
        canonical_name: 'grok-4-1-fast-non-reasoning',
        default_config: new LLMConfig({ pricing_config: pricing(0.2, 0.5) })
      }),
      new LLMModel({
        name: 'grok-code-fast-1',
        value: 'grok-code-fast-1',
        provider: LLMProvider.GROK,
        llm_class: GrokLLM,
        canonical_name: 'grok-code-fast-1',
        default_config: new LLMConfig({ pricing_config: pricing(0.2, 1.5) })
      }),
      new LLMModel({
        name: 'claude-4.5-opus',
        value: 'claude-opus-4-5-20251101',
        provider: LLMProvider.ANTHROPIC,
        llm_class: AnthropicLLM,
        canonical_name: 'claude-4.5-opus',
        default_config: new LLMConfig({ pricing_config: pricing(5.0, 25.0) }),
        config_schema: claudeSchema
      }),
      new LLMModel({
        name: 'claude-4.5-sonnet',
        value: 'claude-sonnet-4-5-20250929',
        provider: LLMProvider.ANTHROPIC,
        llm_class: AnthropicLLM,
        canonical_name: 'claude-4.5-sonnet',
        default_config: new LLMConfig({ pricing_config: pricing(3.0, 15.0) }),
        config_schema: claudeSchema
      }),
      new LLMModel({
        name: 'claude-4.5-haiku',
        value: 'claude-haiku-4-5-20251001',
        provider: LLMProvider.ANTHROPIC,
        llm_class: AnthropicLLM,
        canonical_name: 'claude-4.5-haiku',
        default_config: new LLMConfig({ pricing_config: pricing(1.0, 5.0) }),
        config_schema: claudeSchema
      }),
      new LLMModel({
        name: 'deepseek-chat',
        value: 'deepseek-chat',
        provider: LLMProvider.DEEPSEEK,
        llm_class: DeepSeekLLM,
        canonical_name: 'deepseek-chat',
        default_config: new LLMConfig({
          rate_limit: 60,
          token_limit: 8000,
          pricing_config: pricing(0.014, 0.28)
        })
      }),
      new LLMModel({
        name: 'deepseek-reasoner',
        value: 'deepseek-reasoner',
        provider: LLMProvider.DEEPSEEK,
        llm_class: DeepSeekLLM,
        canonical_name: 'deepseek-reasoner',
        default_config: new LLMConfig({
          rate_limit: 60,
          token_limit: 8000,
          pricing_config: pricing(0.14, 2.19)
        })
      }),
      new LLMModel({
        name: 'gemini-3-pro-preview',
        value: 'gemini-3-pro-preview',
        provider: LLMProvider.GEMINI,
        llm_class: GeminiLLM,
        canonical_name: 'gemini-3-pro',
        default_config: new LLMConfig({ pricing_config: pricing(2.0, 12.0) }),
        config_schema: geminiSchema
      }),
      new LLMModel({
        name: 'gemini-3-flash-preview',
        value: 'gemini-3-flash-preview',
        provider: LLMProvider.GEMINI,
        llm_class: GeminiLLM,
        canonical_name: 'gemini-3-flash',
        default_config: new LLMConfig({ pricing_config: pricing(0.5, 3.0) }),
        config_schema: geminiSchema
      }),
      new LLMModel({
        name: 'kimi-k2-0711-preview',
        value: 'kimi-k2-0711-preview',
        provider: LLMProvider.KIMI,
        llm_class: KimiLLM,
        canonical_name: 'kimi-k2-0711-preview',
        default_config: new LLMConfig({ pricing_config: pricing(0.55, 2.21) })
      }),
      new LLMModel({
        name: 'kimi-k2-0905-preview',
        value: 'kimi-k2-0905-preview',
        provider: LLMProvider.KIMI,
        llm_class: KimiLLM,
        canonical_name: 'kimi-k2-0905-preview',
        default_config: new LLMConfig({ pricing_config: pricing(0.55, 2.21) })
      }),
      new LLMModel({
        name: 'kimi-k2-turbo-preview',
        value: 'kimi-k2-turbo-preview',
        provider: LLMProvider.KIMI,
        llm_class: KimiLLM,
        canonical_name: 'kimi-k2-turbo-preview',
        default_config: new LLMConfig({ pricing_config: pricing(2.76, 2.76) })
      }),
      new LLMModel({
        name: 'kimi-latest',
        value: 'kimi-latest',
        provider: LLMProvider.KIMI,
        llm_class: KimiLLM,
        canonical_name: 'kimi-latest',
        default_config: new LLMConfig({ pricing_config: pricing(1.38, 4.14) })
      }),
      new LLMModel({
        name: 'kimi-thinking-preview',
        value: 'kimi-thinking-preview',
        provider: LLMProvider.KIMI,
        llm_class: KimiLLM,
        canonical_name: 'kimi-thinking-preview',
        default_config: new LLMConfig({ pricing_config: pricing(27.59, 27.59) })
      }),
      new LLMModel({
        name: 'qwen3-max',
        value: 'qwen-max',
        provider: LLMProvider.QWEN,
        llm_class: QwenLLM,
        canonical_name: 'qwen3-max',
        default_config: new LLMConfig({
          token_limit: 262144,
          pricing_config: new TokenPricingConfig({ input_token_pricing: 2.4, output_token_pricing: 12.0 })
        })
      }),
      new LLMModel({
        name: 'glm-4.7',
        value: 'glm-4.7',
        provider: LLMProvider.ZHIPU,
        llm_class: ZhipuLLM,
        canonical_name: 'glm-4.7',
        default_config: new LLMConfig({ pricing_config: pricing(13.8, 13.8) }),
        config_schema: zhipuSchema
      }),
      new LLMModel({
        name: 'minimax-m2.1',
        value: 'MiniMax-M2.1',
        provider: LLMProvider.MINIMAX,
        llm_class: MinimaxLLM,
        canonical_name: 'minimax-m2.1',
        default_config: new LLMConfig({ pricing_config: pricing(0.15, 0.45) })
      })
    ];

    for (const model of supportedModels) {
      LLMFactory.registerModel(model);
    }

    await OllamaModelProvider.discoverAndRegister();
    await LMStudioModelProvider.discoverAndRegister();
    await AutobyteusModelProvider.discoverAndRegister();
  }

  static registerModel(model: LLMModel): void {
    const identifier = model.model_identifier;
    const existing = LLMFactory.modelsByIdentifier.get(identifier);
    if (existing) {
      const providerModels = LLMFactory.modelsByProvider.get(existing.provider);
      if (providerModels) {
        const index = providerModels.indexOf(existing);
        if (index !== -1) {
          providerModels.splice(index, 1);
        }
      }
    }

    LLMFactory.modelsByIdentifier.set(identifier, model);
    const providerModels = LLMFactory.modelsByProvider.get(model.provider) ?? [];
    providerModels.push(model);
    LLMFactory.modelsByProvider.set(model.provider, providerModels);
  }

  static async createLLM(modelIdentifier: string, llmConfig?: LLMConfig): Promise<BaseLLM> {
    await LLMFactory.ensureInitialized();

    const model = LLMFactory.modelsByIdentifier.get(modelIdentifier);
    if (model) {
      const LLMClass = model.llm_class;
      if (!LLMClass) {
        throw new Error(`Model '${model.model_identifier}' does not have an LLM class registered yet.`);
      }
      const config = model.default_config ? model.default_config.clone() : new LLMConfig();
      if (llmConfig) {
        config.mergeWith(llmConfig);
      }
      return new LLMClass(model, config);
    }

    const foundByName = Array.from(LLMFactory.modelsByIdentifier.values()).filter(
      (entry) => entry.name === modelIdentifier
    );
    if (foundByName.length > 1) {
      const identifiers = foundByName.map((entry) => entry.model_identifier);
      throw new Error(
        `The model name '${modelIdentifier}' is ambiguous. Please use one of the unique model identifiers: ${identifiers}`
      );
    }

    throw new Error(`Model with identifier '${modelIdentifier}' not found.`);
  }

  static async listAvailableModels(): Promise<ModelInfo[]> {
    await LLMFactory.ensureInitialized();
    const models = Array.from(LLMFactory.modelsByIdentifier.values()).sort((a, b) =>
      a.model_identifier.localeCompare(b.model_identifier)
    );
    return models.map((model) => model.toModelInfo());
  }

  static async listModelsByProvider(provider: LLMProvider): Promise<ModelInfo[]> {
    await LLMFactory.ensureInitialized();
    const models = Array.from(LLMFactory.modelsByIdentifier.values())
      .filter((model) => model.provider === provider)
      .sort((a, b) => a.model_identifier.localeCompare(b.model_identifier));
    return models.map((model) => model.toModelInfo());
  }

  static async listModelsByRuntime(runtime: LLMRuntime): Promise<ModelInfo[]> {
    await LLMFactory.ensureInitialized();
    const models = Array.from(LLMFactory.modelsByIdentifier.values())
      .filter((model) => model.runtime === runtime)
      .sort((a, b) => a.model_identifier.localeCompare(b.model_identifier));
    return models.map((model) => model.toModelInfo());
  }

  static async getCanonicalName(modelIdentifier: string): Promise<string | null> {
    await LLMFactory.ensureInitialized();
    const model = LLMFactory.modelsByIdentifier.get(modelIdentifier);
    if (model) {
      return model.canonical_name;
    }

    console.warn(`Could not find model with identifier '${modelIdentifier}' to get its canonical name.`);
    return null;
  }

  static async reloadModels(provider: LLMProvider): Promise<number> {
    await LLMFactory.ensureInitialized();

    const providerHandlers: Partial<Record<LLMProvider, { getModels: () => Promise<LLMModel[]> }>> = {
      [LLMProvider.LMSTUDIO]: LMStudioModelProvider,
      [LLMProvider.AUTOBYTEUS]: AutobyteusModelProvider,
      [LLMProvider.OLLAMA]: OllamaModelProvider
    };

    const handler = providerHandlers[provider];
    if (!handler) {
      const currentCount = LLMFactory.modelsByProvider.get(provider)?.length ?? 0;
      console.warn(`Reloading is not supported for provider: ${provider}`);
      return currentCount;
    }

    const currentProviderModels = LLMFactory.modelsByProvider.get(provider) ?? [];
    const idsToRemove = currentProviderModels.map((model) => model.model_identifier);

    console.log(`Clearing ${idsToRemove.length} models for provider ${provider} before discovery.`);

    for (const id of idsToRemove) {
      LLMFactory.modelsByIdentifier.delete(id);
    }
    LLMFactory.modelsByProvider.delete(provider);

    let newModels: LLMModel[] = [];
    try {
      newModels = await handler.getModels();
    } catch (error: any) {
      console.error(`Failed to fetch models for ${provider}. Registry for this provider is now empty.`, error?.message ?? error);
      return 0;
    }

    console.log(`Registering ${newModels.length} new models for provider ${provider}.`);
    for (const model of newModels) {
      LLMFactory.registerModel(model);
    }

    return newModels.length;
  }
}

export const defaultLlmFactory = LLMFactory;
