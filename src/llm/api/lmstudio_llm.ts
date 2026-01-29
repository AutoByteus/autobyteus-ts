import { OpenAICompatibleLLM } from './openai_compatible_llm.js';
import { LLMModel } from '../models.js';
import { LLMConfig } from '../utils/llm_config.js';

export class LMStudioLLM extends OpenAICompatibleLLM {
  constructor(model: LLMModel, llmConfig?: LLMConfig) {
    if (!model.host_url) {
      throw new Error('LMStudioLLM requires a host_url to be set on the LLMModel.');
    }

    const hostUrl = model.host_url.replace(/\/+$/, '');
    const baseUrl = `${hostUrl}/v1`;

    super(model, 'LMSTUDIO_API_KEY', baseUrl, llmConfig, 'lm-studio');
  }
}
