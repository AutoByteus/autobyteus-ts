import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  waitForAgent: vi.fn(async () => undefined),
  waitForTeam: vi.fn(async () => undefined),
  createTeam: vi.fn()
}));

vi.mock('../../../../src/agent/utils/wait_for_idle.js', () => ({
  wait_for_agent_to_be_idle: mocks.waitForAgent
}));

vi.mock('../../../../src/agent_team/utils/wait_for_idle.js', () => ({
  wait_for_team_to_be_idle: mocks.waitForTeam
}));

(vi.mock as any)(
  '../../../../src/agent_team/factory/agent_team_factory.js',
  () => ({
    AgentTeamFactory: vi.fn().mockImplementation(function (this: any) {
      this.create_team = mocks.createTeam;
    })
  }),
  { virtual: true }
);

import { TeamManager } from '../../../../src/agent_team/context/team_manager.js';
import { TeamNodeConfig } from '../../../../src/agent_team/context/team_node_config.js';
import { AgentTeamConfig } from '../../../../src/agent_team/context/agent_team_config.js';
import { TeamNodeNotFoundException } from '../../../../src/agent_team/exceptions.js';
import { Agent } from '../../../../src/agent/agent.js';
import { AgentTeam } from '../../../../src/agent_team/agent_team.js';
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

const makeAgentConfig = (name: string) => {
  const model = new LLMModel({
    name: 'dummy',
    value: 'dummy',
    canonical_name: 'dummy',
    provider: LLMProvider.OPENAI
  });
  const llm = new DummyLLM(model, new LLMConfig());
  return new AgentConfig(name, name, `${name} desc`, llm);
};

const makeSubTeamConfig = (name: string) => {
  const coordinator = makeAgentConfig(`${name}_Coordinator`);
  const coordinatorNode = new TeamNodeConfig({ node_definition: coordinator });
  return new AgentTeamConfig({
    name,
    description: `${name} desc`,
    nodes: [coordinatorNode],
    coordinator_node: coordinatorNode
  });
};

const makeRuntime = () => {
  const context = {
    get_node_config_by_name: vi.fn(),
    state: {
      final_agent_configs: {} as Record<string, AgentConfig>
    }
  } as any;
  return { context, submit_event: vi.fn(async () => undefined) } as any;
};

const makeMultiplexer = () => ({
  start_bridging_agent_events: vi.fn(),
  start_bridging_team_events: vi.fn()
});

const makeMockAgentInstance = (agent_id: string, running: boolean = false) => {
  const agent = Object.assign(Object.create(Agent.prototype), {
    agent_id,
    start: vi.fn(),
    setRunning: (value: boolean) => {
      isRunning = value;
    }
  });
  let isRunning = running;
  Object.defineProperty(agent, 'is_running', {
    get: () => isRunning,
    configurable: true
  });
  return agent;
};

const makeMockTeamInstance = (running: boolean = false) => {
  const team = Object.assign(Object.create(AgentTeam.prototype), {
    start: vi.fn(),
    setRunning: (value: boolean) => {
      isRunning = value;
    }
  });
  let isRunning = running;
  Object.defineProperty(team, 'is_running', {
    get: () => isRunning,
    configurable: true
  });
  Object.defineProperty(team, 'name', {
    get: () => 'SubTeam',
    configurable: true
  });
  return team;
};

describe('TeamManager', () => {
  beforeEach(() => {
    mocks.waitForAgent.mockReset();
    mocks.waitForTeam.mockReset();
    mocks.createTeam.mockReset();
  });

  it('uses premade agent config and starts agent', async () => {
    const runtime = makeRuntime();
    const multiplexer = makeMultiplexer();
    const manager = new TeamManager('test_team', runtime, multiplexer as any);

    const mockAgent = makeMockAgentInstance('agent_123');
    const mockAgentFactory = { create_agent: vi.fn(() => mockAgent) } as any;
    manager._agent_factory = mockAgentFactory;

    const nodeName = 'test_agent';
    const premadeConfig = makeAgentConfig(nodeName);
    runtime.context.state.final_agent_configs[nodeName] = premadeConfig;

    const nodeConfigWrapper = new TeamNodeConfig({ node_definition: premadeConfig });
    runtime.context.get_node_config_by_name.mockReturnValue(nodeConfigWrapper);

    const agent = await manager.ensure_node_is_ready(nodeName);

    expect(agent).toBe(mockAgent);
    expect(runtime.context.get_node_config_by_name).toHaveBeenCalledWith(nodeName);
    expect(mockAgentFactory.create_agent).toHaveBeenCalledWith(premadeConfig);
    expect(manager._nodes_cache.get(nodeName)).toBe(mockAgent);
    expect(manager._agent_id_to_name_map.get(mockAgent.agent_id)).toBe(nodeName);
    expect(multiplexer.start_bridging_agent_events).toHaveBeenCalledWith(mockAgent, nodeName);
    expect(multiplexer.start_bridging_team_events).not.toHaveBeenCalled();
    expect(mockAgent.start).toHaveBeenCalledOnce();
    expect(mocks.waitForAgent).toHaveBeenCalledWith(mockAgent, 60.0);
  });

  it('creates and starts sub-team nodes', async () => {
    const runtime = makeRuntime();
    const multiplexer = makeMultiplexer();
    const manager = new TeamManager('test_team', runtime, multiplexer as any);

    const subTeamConfig = makeSubTeamConfig('test_sub_team');
    const nodeConfigWrapper = {
      is_sub_team: true,
      node_definition: subTeamConfig
    } as any;
    runtime.context.get_node_config_by_name.mockReturnValue(nodeConfigWrapper);

    const mockSubTeam = makeMockTeamInstance();
    mocks.createTeam.mockReturnValue(mockSubTeam);

    const subTeam = await manager.ensure_node_is_ready('test_sub_team');

    expect(subTeam).toBe(mockSubTeam);
    expect(mocks.createTeam).toHaveBeenCalledWith(subTeamConfig);
    expect(multiplexer.start_bridging_team_events).toHaveBeenCalledWith(mockSubTeam, 'test_sub_team');
    expect(multiplexer.start_bridging_agent_events).not.toHaveBeenCalled();
    expect(mockSubTeam.start).toHaveBeenCalledOnce();
    expect(mocks.waitForTeam).toHaveBeenCalledWith(mockSubTeam, 120.0);
  });

  it('returns cached running node', async () => {
    const runtime = makeRuntime();
    const multiplexer = makeMultiplexer();
    const manager = new TeamManager('test_team', runtime, multiplexer as any);

    const mockAgent = makeMockAgentInstance('cached_agent_id');
    (mockAgent as any).setRunning(true);
    manager._nodes_cache.set('cached_agent', mockAgent);

    const agent = await manager.ensure_node_is_ready('cached_agent');

    expect(agent).toBe(mockAgent);
    expect(mockAgent.start).not.toHaveBeenCalled();
    expect(mocks.waitForAgent).not.toHaveBeenCalled();
  });

  it('resolves agent_id to cached name', async () => {
    const runtime = makeRuntime();
    const multiplexer = makeMultiplexer();
    const manager = new TeamManager('test_team', runtime, multiplexer as any);

    const mockAgent = makeMockAgentInstance('agent_abc_123');
    manager._agent_id_to_name_map.set('agent_abc_123', 'my_agent');
    manager._nodes_cache.set('my_agent', mockAgent);

    const agent = await manager.ensure_node_is_ready('agent_abc_123');

    expect(agent).toBe(mockAgent);
    expect(runtime.context.get_node_config_by_name).not.toHaveBeenCalled();
  });

  it('throws TeamNodeNotFoundException for unknown nodes', async () => {
    const runtime = makeRuntime();
    const multiplexer = makeMultiplexer();
    const manager = new TeamManager('test_team', runtime, multiplexer as any);
    runtime.context.get_node_config_by_name.mockReturnValue(null);

    await expect(manager.ensure_node_is_ready('unknown_agent')).rejects.toBeInstanceOf(TeamNodeNotFoundException);
  });

  it('throws when premade config missing', async () => {
    const runtime = makeRuntime();
    const multiplexer = makeMultiplexer();
    const manager = new TeamManager('test_team', runtime, multiplexer as any);

    const nodeConfigWrapper = new TeamNodeConfig({ node_definition: makeAgentConfig('forgotten_agent') });
    runtime.context.get_node_config_by_name.mockReturnValue(nodeConfigWrapper);

    await expect(manager.ensure_node_is_ready('forgotten_agent')).rejects.toThrow(
      'No pre-prepared agent configuration found'
    );
  });
});
