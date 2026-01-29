import { OpenAICompatibleLLM } from './openai_compatible_llm.js';
import { LLMModel } from '../models.js';
import { LLMConfig } from '../utils/llm_config.js';
import { LLMProvider } from '../providers.js';

function normalizeZhipuExtraParams(extraParams?: Record<string, any>): Record<string, any> {
  if (!extraParams) return {};

  const params = { ...extraParams };
  const thinkingType = params.thinking_type;
  delete params.thinking_type;

  if (thinkingType !== undefined) {
    const thinking = { ...(params.thinking ?? {}) };
    thinking.type = thinkingType;
    params.thinking = thinking;
  }

  return params;
}

export class ZhipuLLM extends OpenAICompatibleLLM {
  constructor(model?: LLMModel, llmConfig?: LLMConfig) {
    const effectiveModel =
      model ??
      new LLMModel({
        name: 'glm-4.7',
        value: 'glm-4.7',
        canonical_name: 'glm-4.7',
        provider: LLMProvider.ZHIPU
      });

    const config = llmConfig ?? new LLMConfig();

    super(effectiveModel, 'ZHIPU_API_KEY', 'https://open.bigmodel.cn/api/paas/v4/', config);

    if (this.config?.extra_params && typeof this.config.extra_params === 'object') {
      this.config.extra_params = normalizeZhipuExtraParams(this.config.extra_params);
    }
  }
}
