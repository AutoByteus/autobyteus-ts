import { OpenAICompatibleLLM } from './openai_compatible_llm.js';
import { LLMModel } from '../models.js';
import { LLMConfig } from '../utils/llm_config.js';
import { LLMProvider } from '../providers.js';

export class MinimaxLLM extends OpenAICompatibleLLM {
  constructor(model?: LLMModel, llmConfig?: LLMConfig) {
    const effectiveModel =
      model ??
      new LLMModel({
        name: 'minimax-m2.1',
        value: 'MiniMax-M2.1',
        canonicalName: 'minimax-m2.1',
        provider: LLMProvider.MINIMAX
      });

    const config = llmConfig ?? new LLMConfig();

    super(effectiveModel, 'MINIMAX_API_KEY', 'https://api.minimax.io/v1', config);
  }
}
