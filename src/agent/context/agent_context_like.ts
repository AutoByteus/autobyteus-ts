import type { LLMProvider } from '../../llm/providers.js';

export type AgentContextLike = {
  agent_id: string;
  auto_execute_tools?: boolean;
  config?: {
    name?: string;
    skills?: string[];
  };
  llm_instance?: {
    model?: {
      provider?: LLMProvider;
    };
  } | null;
};
