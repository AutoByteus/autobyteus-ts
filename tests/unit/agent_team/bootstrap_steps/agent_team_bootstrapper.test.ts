import { describe, it, expect, vi } from 'vitest';
import { AgentTeamBootstrapper } from '../../../../src/agent_team/bootstrap_steps/agent_team_bootstrapper.js';
import { BaseAgentTeamBootstrapStep } from '../../../../src/agent_team/bootstrap_steps/base_agent_team_bootstrap_step.js';
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

vi.mock('../../../../src/agent_team/bootstrap_steps/team_context_initialization_step.js', () => ({
  TeamContextInitializationStep: vi.fn().mockImplementation(function () {})
}));
vi.mock('../../../../src/agent_team/bootstrap_steps/task_notifier_initialization_step.js', () => ({
  TaskNotifierInitializationStep: vi.fn().mockImplementation(function () {})
}));
vi.mock('../../../../src/agent_team/bootstrap_steps/team_manifest_injection_step.js', () => ({
  TeamManifestInjectionStep: vi.fn().mockImplementation(function () {})
}));
vi.mock('../../../../src/agent_team/bootstrap_steps/agent_configuration_preparation_step.js', () => ({
  AgentConfigurationPreparationStep: vi.fn().mockImplementation(function () {})
}));
vi.mock('../../../../src/agent_team/bootstrap_steps/coordinator_initialization_step.js', () => ({
  CoordinatorInitializationStep: vi.fn().mockImplementation(function () {})
}));

import { TeamContextInitializationStep } from '../../../../src/agent_team/bootstrap_steps/team_context_initialization_step.js';
import { TaskNotifierInitializationStep } from '../../../../src/agent_team/bootstrap_steps/task_notifier_initialization_step.js';
import { TeamManifestInjectionStep } from '../../../../src/agent_team/bootstrap_steps/team_manifest_injection_step.js';
import { AgentConfigurationPreparationStep } from '../../../../src/agent_team/bootstrap_steps/agent_configuration_preparation_step.js';
import { CoordinatorInitializationStep } from '../../../../src/agent_team/bootstrap_steps/coordinator_initialization_step.js';

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
  state.input_event_queues = {} as any;
  return new AgentTeamContext('team-1', config, state);
};

class MockStep1 extends BaseAgentTeamBootstrapStep {
  async execute(_context: AgentTeamContext): Promise<boolean> {
    return true;
  }
}

class MockStep2 extends BaseAgentTeamBootstrapStep {
  async execute(_context: AgentTeamContext): Promise<boolean> {
    return true;
  }
}

describe('AgentTeamBootstrapper', () => {
  it('initializes with default steps', () => {
    const bootstrapper = new AgentTeamBootstrapper();

    expect(TeamContextInitializationStep).toHaveBeenCalledTimes(1);
    expect(TaskNotifierInitializationStep).toHaveBeenCalledTimes(1);
    expect(TeamManifestInjectionStep).toHaveBeenCalledTimes(1);
    expect(AgentConfigurationPreparationStep).toHaveBeenCalledTimes(1);
    expect(CoordinatorInitializationStep).toHaveBeenCalledTimes(1);
    expect(bootstrapper.bootstrap_steps.length).toBe(5);
  });

  it('initializes with custom steps', () => {
    const step1 = new MockStep1();
    const step2 = new MockStep2();
    const bootstrapper = new AgentTeamBootstrapper([step1, step2]);

    expect(bootstrapper.bootstrap_steps).toEqual([step1, step2]);
    expect(bootstrapper.bootstrap_steps.length).toBe(2);
  });

  it('runs all steps successfully', async () => {
    const step1 = { execute: vi.fn(async () => true) } as any;
    const step2 = { execute: vi.fn(async () => true) } as any;
    const bootstrapper = new AgentTeamBootstrapper([step1, step2]);
    const context = makeContext();

    const success = await bootstrapper.run(context);

    expect(success).toBe(true);
    expect(step1.execute).toHaveBeenCalledWith(context);
    expect(step2.execute).toHaveBeenCalledWith(context);
  });

  it('stops on failed step', async () => {
    const step1 = { execute: vi.fn(async () => false) } as any;
    const step2 = { execute: vi.fn(async () => true) } as any;
    const bootstrapper = new AgentTeamBootstrapper([step1, step2]);
    const context = makeContext();

    const success = await bootstrapper.run(context);

    expect(success).toBe(false);
    expect(step1.execute).toHaveBeenCalled();
    expect(step2.execute).not.toHaveBeenCalled();
  });

  it('fails if queues missing after success', async () => {
    const step1 = { execute: vi.fn(async () => true) } as any;
    const bootstrapper = new AgentTeamBootstrapper([step1]);
    const context = makeContext();
    context.state.input_event_queues = null;

    const success = await bootstrapper.run(context);

    expect(success).toBe(false);
  });
});
