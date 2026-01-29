import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CoordinatorInitializationStep } from '../../../../src/agent_team/bootstrap_steps/coordinator_initialization_step.js';
import { AgentTeamContext } from '../../../../src/agent_team/context/agent_team_context.js';
import { AgentTeamConfig } from '../../../../src/agent_team/context/agent_team_config.js';
import { TeamNodeConfig } from '../../../../src/agent_team/context/team_node_config.js';
import { AgentTeamRuntimeState } from '../../../../src/agent_team/context/agent_team_runtime_state.js';
import { AgentConfig } from '../../../../src/agent/context/agent_config.js';
import { BaseLLM } from '../../../../src/llm/base.js';
import { LLMModel } from '../../../../src/llm/models.js';
import { LLMProvider } from '../../../../src/llm/providers.js';
import { LLMConfig } from '../../../../src/llm/utils/llm_config.js';
import { CompleteResponse, ChunkResponse } from '../../../../src/llm/utils/response_types.js';
import { LLMUserMessage } from '../../../../src/llm/user_message.js';

class DummyLLM extends BaseLLM {
  protected async _sendUserMessageToLLM(_userMessage: LLMUserMessage): Promise<CompleteResponse> {
    return new CompleteResponse({ content: 'ok' });
  }

  protected async *_streamUserMessageToLLM(_userMessage: LLMUserMessage): AsyncGenerator<ChunkResponse, void, unknown> {
    yield new ChunkResponse({ content: 'ok', is_complete: true });
  }
}

const makeAgentConfig = (name: string): AgentConfig => {
  const model = new LLMModel({
    name: 'dummy',
    value: 'dummy',
    canonical_name: 'dummy',
    provider: LLMProvider.OPENAI
  });
  const llm = new DummyLLM(model, new LLMConfig());
  return new AgentConfig(name, name, `${name} description`, llm);
};

const makeContext = (): AgentTeamContext => {
  const node = new TeamNodeConfig({ node_definition: makeAgentConfig('Coordinator') });
  const config = new AgentTeamConfig({
    name: 'Team',
    description: 'desc',
    nodes: [node],
    coordinator_node: node
  });
  const state = new AgentTeamRuntimeState({ team_id: 'team-1' });
  state.team_manager = { team_id: 'team-1' } as any;
  return new AgentTeamContext('team-1', config, state);
};

describe('CoordinatorInitializationStep', () => {
  let step: CoordinatorInitializationStep;
  let context: AgentTeamContext;

  beforeEach(() => {
    step = new CoordinatorInitializationStep();
    context = makeContext();
  });

  it('initializes coordinator via team manager', async () => {
    const mock_manager: any = context.team_manager;
    mock_manager.ensure_coordinator_is_ready = vi.fn(async () => ({ agent_id: 'coordinator-1' }));
    const coordinator_name = context.config.coordinator_node.name;

    const success = await step.execute(context);

    expect(success).toBe(true);
    expect(mock_manager.ensure_coordinator_is_ready).toHaveBeenCalledWith(coordinator_name);
  });

  it('fails if team manager missing', async () => {
    context.state.team_manager = null;

    const success = await step.execute(context);

    expect(success).toBe(false);
  });

  it('fails if coordinator creation fails', async () => {
    const mock_manager: any = context.team_manager;
    mock_manager.ensure_coordinator_is_ready = vi.fn(async () => {
      throw new Error('Config not found');
    });

    const success = await step.execute(context);

    expect(success).toBe(false);
  });
});
