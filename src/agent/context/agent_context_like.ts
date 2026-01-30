import type { LLMProvider } from '../../llm/providers.js';

export type AgentContextLike = {
  agentId: string;
  autoExecuteTools?: boolean;
  config?: {
    name?: string;
    skills?: string[];
  };
  llmInstance?: {
    model?: {
      provider?: LLMProvider;
    };
  } | null;
};
