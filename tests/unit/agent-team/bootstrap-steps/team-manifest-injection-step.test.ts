import { describe, it, expect } from 'vitest';
import { TeamManifestInjectionStep } from '../../../../src/agent-team/bootstrap-steps/team-manifest-injection-step.js';
import { AgentTeamContext } from '../../../../src/agent-team/context/agent-team-context.js';
import { AgentTeamConfig } from '../../../../src/agent-team/context/agent-team-config.js';
import { TeamNodeConfig } from '../../../../src/agent-team/context/team-node-config.js';
import { AgentTeamRuntimeState } from '../../../../src/agent-team/context/agent-team-runtime-state.js';
import { AgentConfig } from '../../../../src/agent/context/agent-config.js';
import { BaseLLM } from '../../../../src/llm/base.js';
import { LLMModel } from '../../../../src/llm/models.js';
import { LLMProvider } from '../../../../src/llm/providers.js';
import { LLMConfig } from '../../../../src/llm/utils/llm-config.js';
import { CompleteResponse, ChunkResponse } from '../../../../src/llm/utils/response-types.js';
import { LLMUserMessage } from '../../../../src/llm/user-message.js';

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
    canonicalName: 'dummy',
    provider: LLMProvider.OPENAI
  });
  const llm = new DummyLLM(model, new LLMConfig());
  return new AgentConfig(name, name, `${name} description`, llm);
};

const rebuildContextWithConfig = (context: AgentTeamContext, newConfig: AgentTeamConfig) => {
  context.config = newConfig;
  (context as any).nodeConfigMap = null;
};

const makeContext = (): AgentTeamContext => {
  const node = new TeamNodeConfig({ nodeDefinition: makeAgentConfig('Coordinator') });
  const config = new AgentTeamConfig({
    name: 'Team',
    description: 'desc',
    nodes: [node],
    coordinatorNode: node
  });
  const state = new AgentTeamRuntimeState({ teamId: 'team-1' });
  return new AgentTeamContext('team-1', config, state);
};

describe('TeamManifestInjectionStep', () => {
  it('injects manifest for each agent', async () => {
    const step = new TeamManifestInjectionStep();
    const context = makeContext();

    const coordinatorDef = makeAgentConfig('Coordinator');
    coordinatorDef.systemPrompt = 'Team Manifest:\n{{team}}';

    const memberDef = makeAgentConfig('Member');
    memberDef.systemPrompt = 'Known team:\n{{team}}';
    memberDef.description = 'This is the member agent.';

    const coordinatorNode = new TeamNodeConfig({ nodeDefinition: coordinatorDef });
    const memberNode = new TeamNodeConfig({ nodeDefinition: memberDef });

    const newTeamConfig = new AgentTeamConfig({
      name: 'Team',
      description: 'desc',
      nodes: [coordinatorNode, memberNode],
      coordinatorNode: coordinatorNode
    });
    rebuildContextWithConfig(context, newTeamConfig);

    const success = await step.execute(context);

    expect(success).toBe(true);
    const prompts = context.state.preparedAgentPrompts;
    expect(prompts[coordinatorNode.name]).toBe(
      'Team Manifest:\n- name: Member\n  description: This is the member agent.'
    );
    const expectedMemberView = `Known team:\n- name: Coordinator\n  description: ${coordinatorDef.description}`;
    expect(prompts[memberNode.name]).toBe(expectedMemberView);
  });

  it('handles solo agent', async () => {
    const step = new TeamManifestInjectionStep();
    const context = makeContext();

    const coordinatorDef = makeAgentConfig('Solo');
    coordinatorDef.systemPrompt = 'My Team: {{team}}';
    const coordinatorNode = new TeamNodeConfig({ nodeDefinition: coordinatorDef });

    const soloConfig = new AgentTeamConfig({
      name: 'Solo Team',
      nodes: [coordinatorNode],
      coordinatorNode: coordinatorNode,
      description: 'Solo agent team'
    });
    rebuildContextWithConfig(context, soloConfig);

    const success = await step.execute(context);

    expect(success).toBe(true);
    const prompts = context.state.preparedAgentPrompts;
    expect(prompts['Solo']).toBe(
      'My Team: You are working alone. You have no team members to delegate to.'
    );
  });

  it('injects manifest even when {{team}} is missing', async () => {
    const step = new TeamManifestInjectionStep();
    const context = makeContext();

    const coordinatorDef = makeAgentConfig('Coordinator');
    coordinatorDef.systemPrompt = 'Intro\\n\\n### Your Team\\nThese are your peers.';

    const memberDef = makeAgentConfig('Member');
    memberDef.systemPrompt = 'Intro\\n\\n### Your Team\\nThese are your peers.';
    memberDef.description = 'Member description.';

    const coordinatorNode = new TeamNodeConfig({ nodeDefinition: coordinatorDef });
    const memberNode = new TeamNodeConfig({ nodeDefinition: memberDef });

    const newTeamConfig = new AgentTeamConfig({
      name: 'Team',
      description: 'desc',
      nodes: [coordinatorNode, memberNode],
      coordinatorNode: coordinatorNode
    });
    rebuildContextWithConfig(context, newTeamConfig);

    const success = await step.execute(context);

    expect(success).toBe(true);
    const prompts = context.state.preparedAgentPrompts;
    expect(prompts[coordinatorNode.name]).toContain('### Your Team');
    expect(prompts[coordinatorNode.name]).toContain('- name: Member');
    expect(prompts[memberNode.name]).toContain('- name: Coordinator');
  });

  it('returns false when manifest generation fails', async () => {
    const step = new TeamManifestInjectionStep();
    const context = makeContext();

    const coordinatorDef = makeAgentConfig('Coordinator');
    coordinatorDef.systemPrompt = '{{team}}';
    const coordinatorNode = new TeamNodeConfig({ nodeDefinition: coordinatorDef });
    const newConfig = new AgentTeamConfig({
      name: 'FailTeam',
      description: 'Desc',
      nodes: [coordinatorNode],
      coordinatorNode
    });
    rebuildContextWithConfig(context, newConfig);

    (step as any).generateTeamManifest = () => {
      throw new Error('Synthetic error');
    };

    const success = await step.execute(context);

    expect(success).toBe(false);
    expect(context.state.preparedAgentPrompts).toEqual({});
  });
});
