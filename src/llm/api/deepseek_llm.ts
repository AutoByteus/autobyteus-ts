import { OpenAICompatibleLLM } from './openai_compatible_llm.js';
import { LLMModel } from '../models.js';
import { LLMConfig } from '../utils/llm_config.js';
import { LLMProvider } from '../providers.js';

export class DeepSeekLLM extends OpenAICompatibleLLM {
  constructor(model?: LLMModel, llmConfig?: LLMConfig) {
    const effectiveModel =
      model ??
      new LLMModel({
        name: 'deepseek-chat',
        value: 'deepseek-chat',
        canonical_name: 'deepseek-chat',
        provider: LLMProvider.DEEPSEEK
      });

    const config = llmConfig ?? new LLMConfig();

    super(effectiveModel, 'DEEPSEEK_API_KEY', 'https://api.deepseek.com', config);
  }
}
