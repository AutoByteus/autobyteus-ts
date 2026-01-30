import { describe, it, expect } from 'vitest';
import { AgentConfigurationPreparationStep } from '../../../../src/agent_team/bootstrap_steps/agent_configuration_preparation_step.js';
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
import { CreateTasks } from '../../../../src/task_management/tools/task_tools/create_tasks.js';
import { SendMessageTo } from '../../../../src/agent/message/send_message_to.js';

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
  state.teamManager = { teamId: 'team-1' } as any;
  return new AgentTeamContext('team-1', config, state);
};

describe('AgentConfigurationPreparationStep', () => {
  it('prepares final configs and preserves tools', async () => {
    const step = new AgentConfigurationPreparationStep();
    const context = makeContext();

    const coordinatorDef = makeAgentConfig('Coordinator');
    coordinatorDef.tools = [new CreateTasks(), new SendMessageTo()];

    const memberDef = makeAgentConfig('Member');
    memberDef.tools = [];

    const coordinatorNode = new TeamNodeConfig({ nodeDefinition: coordinatorDef });
    const memberNode = new TeamNodeConfig({ nodeDefinition: memberDef });

    const subTeamCoordinator = new TeamNodeConfig({ nodeDefinition: makeAgentConfig('SubCoord') });
    const subTeamNode = new TeamNodeConfig({
      nodeDefinition: new AgentTeamConfig({
        name: 'SubTeam',
        description: 'sub team',
        nodes: [subTeamCoordinator],
        coordinatorNode: subTeamCoordinator
      })
    });

    const newTeamConfig = new AgentTeamConfig({
      name: 'TestTeamWithExplicitTools',
      description: 'A test team',
      nodes: [coordinatorNode, memberNode, subTeamNode],
      coordinatorNode: coordinatorNode
    });
    rebuildContextWithConfig(context, newTeamConfig);

    context.state.preparedAgentPrompts = {
      [coordinatorNode.name]: 'This is the special coordinator prompt.',
      [memberNode.name]: 'Member prompt'
    };

    const success = await step.execute(context);

    expect(success).toBe(true);

    const finalConfigs = context.state.finalAgentConfigs;
    expect(Object.keys(finalConfigs).length).toBe(2);

    const coordConfig = finalConfigs[coordinatorNode.name];
    expect(coordConfig).toBeInstanceOf(AgentConfig);
    const coordToolNames = coordConfig.tools.map((tool: any) => tool.constructor.getName());
    expect(coordToolNames).toContain(CreateTasks.getName());
    expect(coordToolNames).toContain(SendMessageTo.getName());
    expect(coordToolNames.length).toBe(2);
    expect(coordConfig.systemPrompt).toBe(context.state.preparedAgentPrompts[coordinatorNode.name]);
    expect(coordConfig.initialCustomData?.teamContext).toBe(context);

    const memberConfig = finalConfigs[memberNode.name];
    expect(memberConfig).toBeInstanceOf(AgentConfig);
    expect(memberConfig.tools.length).toBe(0);
    expect(memberConfig.systemPrompt).toBe(context.state.preparedAgentPrompts[memberNode.name]);
    expect(memberConfig.initialCustomData?.teamContext).toBe(context);
  });

  it('fails if team manager missing', async () => {
    const step = new AgentConfigurationPreparationStep();
    const context = makeContext();
    context.state.teamManager = null;

    const success = await step.execute(context);

    expect(success).toBe(false);
  });
});
