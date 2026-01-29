import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runtimeCtor: vi.fn(),
  teamManagerCtor: vi.fn(),
  runtimeInstance: { multiplexer: {} as any } as any,
  teamManagerInstance: {} as any
}));

vi.mock('../../../../src/agent_team/runtime/agent_team_runtime.js', () => ({
  AgentTeamRuntime: function (context: any, registry: any) {
    mocks.runtimeCtor(context, registry);
    mocks.runtimeInstance.context = context;
    mocks.runtimeInstance.multiplexer = { marker: true };
    return mocks.runtimeInstance;
  }
}));

vi.mock('../../../../src/agent_team/context/team_manager.js', () => ({
  TeamManager: function (team_id: string, runtime: any, multiplexer: any) {
    mocks.teamManagerCtor(team_id, runtime, multiplexer);
    return mocks.teamManagerInstance;
  }
}));

import { AgentTeamFactory } from '../../../../src/agent_team/factory/agent_team_factory.js';
import { AgentTeamConfig } from '../../../../src/agent_team/context/agent_team_config.js';
import { TeamNodeConfig } from '../../../../src/agent_team/context/team_node_config.js';
import { AgentTeam } from '../../../../src/agent_team/agent_team.js';
import { ProcessUserMessageEvent } from '../../../../src/agent_team/events/agent_team_events.js';
import { ProcessUserMessageEventHandler } from '../../../../src/agent_team/handlers/process_user_message_event_handler.js';
import { AgentConfig } from '../../../../src/agent/context/agent_config.js';
import { BaseLLM } from '../../../../src/llm/base.js';
import { LLMModel } from '../../../../src/llm/models.js';
import { LLMProvider } from '../../../../src/llm/providers.js';
import { LLMConfig } from '../../../../src/llm/utils/llm_config.js';
import { CompleteResponse, ChunkResponse } from '../../../../src/llm/utils/response_types.js';
import type { LLMUserMessage } from '../../../../src/llm/user_message.js';

class DummyLLM extends BaseLLM {
  protected async _sendUserMessageToLLM(_userMessage: LLMUserMessage): Promise<CompleteResponse> {
    return new CompleteResponse({ content: 'ok' });
  }

  protected async *_streamUserMessageToLLM(
    _userMessage: LLMUserMessage
  ): AsyncGenerator<ChunkResponse, void, unknown> {
    yield new ChunkResponse({ content: 'ok', is_complete: true });
  }
}

const makeTeamConfig = (): AgentTeamConfig => {
  const model = new LLMModel({
    name: 'dummy',
    value: 'dummy',
    canonical_name: 'dummy',
    provider: LLMProvider.OPENAI
  });
  const llm = new DummyLLM(model, new LLMConfig());
  const coordinator = new AgentConfig('Coordinator', 'Coordinator', 'desc', llm);
  const coordinatorNode = new TeamNodeConfig({ node_definition: coordinator });
  return new AgentTeamConfig({
    name: 'TestTeam',
    description: 'Test team description',
    nodes: [coordinatorNode],
    coordinator_node: coordinatorNode
  });
};

const resetFactory = () => {
  (AgentTeamFactory as any).instance = undefined;
};

describe('AgentTeamFactory', () => {
  beforeEach(() => {
    resetFactory();
    mocks.runtimeCtor.mockReset();
    mocks.teamManagerCtor.mockReset();
  });

  afterEach(() => {
    resetFactory();
    vi.restoreAllMocks();
  });

  it('creates a default event handler registry', () => {
    const factory = new AgentTeamFactory();
    const registry = (factory as any)._get_default_event_handler_registry();
    const handler = registry.get_handler(ProcessUserMessageEvent);
    expect(handler).toBeInstanceOf(ProcessUserMessageEventHandler);
  });

  it('assembles components correctly when creating a team', () => {
    const factory = new AgentTeamFactory();
    const config = makeTeamConfig();

    const team = factory.create_team(config);

    expect(team).toBeInstanceOf(AgentTeam);
    const teamId = factory.list_active_team_ids()[0];
    expect(teamId).toBeDefined();
    expect(factory.get_team(teamId)).toBe(team);

    expect(mocks.runtimeCtor).toHaveBeenCalledOnce();
    const runtimeArgs = mocks.runtimeCtor.mock.calls[0];
    const contextArg = runtimeArgs[0];
    const registryArg = runtimeArgs[1];

    expect(contextArg.config).toBe(config);
    expect(registryArg).toBeTruthy();

    expect(mocks.teamManagerCtor).toHaveBeenCalledOnce();
    const teamManagerArgs = mocks.teamManagerCtor.mock.calls[0];
    expect(teamManagerArgs[1]).toBe(mocks.runtimeInstance);
    expect(teamManagerArgs[2]).toBe(mocks.runtimeInstance.multiplexer);

    expect(contextArg.state.team_manager).toBe(mocks.teamManagerInstance);
  });
});
