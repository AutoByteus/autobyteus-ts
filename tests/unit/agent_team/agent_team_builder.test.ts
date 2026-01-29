import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTeam: vi.fn(),
  teamInstance: {} as any
}));

vi.mock('../../../src/agent_team/factory/agent_team_factory.js', () => ({
  AgentTeamFactory: vi.fn().mockImplementation(function (this: any) {
    this.create_team = mocks.createTeam;
  })
}));

import { AgentTeamBuilder } from '../../../src/agent_team/agent_team_builder.js';
import { AgentTeamConfig } from '../../../src/agent_team/context/agent_team_config.js';
import { TeamNodeConfig } from '../../../src/agent_team/context/team_node_config.js';
import { AgentConfig } from '../../../src/agent/context/agent_config.js';
import { BaseLLM } from '../../../src/llm/base.js';
import { LLMModel } from '../../../src/llm/models.js';
import { LLMProvider } from '../../../src/llm/providers.js';
import { LLMConfig } from '../../../src/llm/utils/llm_config.js';
import { CompleteResponse, ChunkResponse } from '../../../src/llm/utils/response_types.js';
import type { LLMUserMessage } from '../../../src/llm/user_message.js';

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
  return new AgentConfig(name, name, `${name} description`, llm);
};

describe('AgentTeamBuilder', () => {
  beforeEach(() => {
    mocks.createTeam.mockReset();
    mocks.teamInstance = {} as any;
  });

  it('builds a team with coordinator and dependency', () => {
    const coordinatorConfig = makeAgentConfig('Coordinator');
    const memberConfig = makeAgentConfig('Member');
    const description = 'Test team description';
    const name = 'TestTeam';

    mocks.createTeam.mockReturnValue(mocks.teamInstance);

    const builder = new AgentTeamBuilder(name, description);
    const team = builder
      .set_coordinator(coordinatorConfig)
      .add_agent_node(memberConfig, [coordinatorConfig])
      .build();

    expect(team).toBe(mocks.teamInstance);
    expect(mocks.createTeam).toHaveBeenCalledOnce();

    const finalTeamConfig: AgentTeamConfig = mocks.createTeam.mock.calls[0][0];
    expect(finalTeamConfig.name).toBe(name);
    expect(finalTeamConfig.description).toBe(description);
    expect(finalTeamConfig.nodes.length).toBe(2);

    const finalCoordNode = finalTeamConfig.coordinator_node;
    const finalMemberNode = finalTeamConfig.nodes.find((n) => n.node_definition === memberConfig) as TeamNodeConfig;

    expect(finalCoordNode.node_definition).toBe(coordinatorConfig);
    expect(finalMemberNode.node_definition).toBe(memberConfig);
    expect(finalMemberNode.dependencies.length).toBe(1);
    expect(finalMemberNode.dependencies[0]).toBe(finalCoordNode);
  });

  it('fails to build without coordinator', () => {
    const builder = new AgentTeamBuilder('Test', 'A team without a coordinator');
    builder.add_agent_node(makeAgentConfig('SomeNode'));

    expect(() => builder.build()).toThrow('A coordinator must be set');
  });

  it('rejects duplicate node names', () => {
    const node1 = makeAgentConfig('DuplicateName');
    const node2 = makeAgentConfig('DuplicateName');

    const builder = new AgentTeamBuilder('Test', 'Test duplicate name');
    builder.add_agent_node(node1);

    expect(() => builder.add_agent_node(node2)).toThrow("Duplicate node name 'DuplicateName' detected");
  });

  it('rejects unknown dependency', () => {
    const nodeConfig = makeAgentConfig('MyNode');
    const dependencyConfig = makeAgentConfig('UnseenDependency');

    const builder = new AgentTeamBuilder('Test', 'Test unknown dependency');

    expect(() => builder.add_agent_node(nodeConfig, [dependencyConfig])).toThrow(
      'must be added to the builder before being used'
    );
  });
});
