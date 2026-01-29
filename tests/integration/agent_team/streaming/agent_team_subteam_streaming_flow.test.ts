import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AgentTeamBuilder } from '../../../../src/agent_team/agent_team_builder.js';
import { AgentTeamConfig } from '../../../../src/agent_team/context/agent_team_config.js';
import { TeamNodeConfig } from '../../../../src/agent_team/context/team_node_config.js';
import { AgentConfig } from '../../../../src/agent/context/agent_config.js';
import { AgentInputUserMessage } from '../../../../src/agent/message/agent_input_user_message.js';
import { OpenAILLM } from '../../../../src/llm/api/openai_llm.js';
import { LLMModel } from '../../../../src/llm/models.js';
import { LLMProvider } from '../../../../src/llm/providers.js';
import type { ChunkResponse } from '../../../../src/llm/utils/response_types.js';
import type { LLMUserMessage } from '../../../../src/llm/user_message.js';
import { registerWriteFileTool } from '../../../../src/tools/file/write_file.js';
import { BaseAgentWorkspace } from '../../../../src/agent/workspace/base_workspace.js';
import { WorkspaceConfig } from '../../../../src/agent/workspace/workspace_config.js';
import { SkillRegistry } from '../../../../src/skills/registry.js';
import { wait_for_team_to_be_idle } from '../../../../src/agent_team/utils/wait_for_idle.js';
import { AgentFactory } from '../../../../src/agent/factory/agent_factory.js';
import { AgentTeamFactory } from '../../../../src/agent_team/factory/agent_team_factory.js';
import { AgentTeamEventStream } from '../../../../src/agent_team/streaming/agent_team_event_stream.js';
import { AgentTeamStreamEvent } from '../../../../src/agent_team/streaming/agent_team_stream_events.js';
import type { AgentTeam } from '../../../../src/agent_team/agent_team.js';

class SimpleWorkspace extends BaseAgentWorkspace {
  private rootPath: string;

  constructor(rootPath: string) {
    super(new WorkspaceConfig({ root_path: rootPath }));
    this.rootPath = rootPath;
  }

  get_base_path(): string {
    return this.rootPath;
  }

  getBasePath(): string {
    return this.rootPath;
  }
}

class RequiredToolOpenAILLM extends OpenAILLM {
  async *streamUserMessage(
    userMessage: LLMUserMessage,
    kwargs: Record<string, any> = {}
  ): AsyncGenerator<ChunkResponse, void, unknown> {
    const nextKwargs = { ...kwargs, tool_choice: 'required' };
    yield* super.streamUserMessage(userMessage, nextKwargs);
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForFile = async (filePath: string, timeoutMs = 20000, intervalMs = 100): Promise<boolean> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fsSync.existsSync(filePath)) {
      return true;
    }
    await delay(intervalMs);
  }
  return false;
};

const collectEvents = async (stream: AgentTeamEventStream, timeoutMs = 15000): Promise<AgentTeamStreamEvent[]> => {
  const events: AgentTeamStreamEvent[] = [];
  const iterator = stream.all_events();
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const result = await Promise.race([
      iterator.next(),
      new Promise<{ timedOut: true }>((resolve) => setTimeout(() => resolve({ timedOut: true }), 200))
    ]);

    if ((result as any).timedOut) {
      continue;
    }

    const typed = result as IteratorResult<AgentTeamStreamEvent>;
    if (typed.done) {
      break;
    }
    events.push(typed.value);
  }

  return events;
};

const resetFactories = () => {
  (AgentFactory as any).instance = undefined;
  (AgentTeamFactory as any).instance = undefined;
};

const apiKey = process.env.OPENAI_API_KEY;
const runIntegration = apiKey ? describe : describe.skip;

runIntegration('Agent team sub-team streaming integration (OpenAI, api_tool_call)', () => {
  let tempDirParentCoordinator: string;
  let tempDirSubCoordinator: string;
  let originalParserEnv: string | undefined;
  let team: AgentTeam | null = null;

  beforeEach(async () => {
    originalParserEnv = process.env.AUTOBYTEUS_STREAM_PARSER;
    process.env.AUTOBYTEUS_STREAM_PARSER = 'api_tool_call';
    SkillRegistry.getInstance().clear();
    resetFactories();
    tempDirParentCoordinator = await fs.mkdtemp(path.join(os.tmpdir(), 'autobyteus-team-parent-coordinator-'));
    tempDirSubCoordinator = await fs.mkdtemp(path.join(os.tmpdir(), 'autobyteus-team-sub-coordinator-'));
  });

  afterEach(async () => {
    if (team) {
      await team.stop(10.0);
      team = null;
    }
    if (originalParserEnv === undefined) {
      delete process.env.AUTOBYTEUS_STREAM_PARSER;
    } else {
      process.env.AUTOBYTEUS_STREAM_PARSER = originalParserEnv;
    }
    SkillRegistry.getInstance().clear();
    resetFactories();
    await fs.rm(tempDirParentCoordinator, { recursive: true, force: true });
    await fs.rm(tempDirSubCoordinator, { recursive: true, force: true });
  });

  it('rebroadcasts sub-team events to the parent stream', async () => {
    const tool = registerWriteFileTool();
    const toolArgs = { path: 'subteam_output.txt', content: 'Sub-team output.' };

    const model = new LLMModel({
      name: 'gpt-5.2',
      value: 'gpt-5.2',
      canonical_name: 'gpt-5.2',
      provider: LLMProvider.OPENAI
    });

    const parentCoordinatorConfig = new AgentConfig(
      'ParentCoordinator',
      'Coordinator',
      'Parent team coordinator',
      new RequiredToolOpenAILLM(model),
      null,
      [tool],
      true,
      null,
      null,
      null,
      null,
      null,
      new SimpleWorkspace(tempDirParentCoordinator)
    );

    const subCoordinatorConfig = new AgentConfig(
      'SubCoordinator',
      'Coordinator',
      'Sub-team coordinator',
      new RequiredToolOpenAILLM(model),
      null,
      [tool],
      true,
      null,
      null,
      null,
      null,
      null,
      new SimpleWorkspace(tempDirSubCoordinator)
    );

    const subCoordinatorNode = new TeamNodeConfig({ node_definition: subCoordinatorConfig });
    const subTeamConfig = new AgentTeamConfig({
      name: 'SubTeam',
      description: 'Sub-team integration test',
      nodes: [subCoordinatorNode],
      coordinator_node: subCoordinatorNode
    });

    const parentBuilder = new AgentTeamBuilder('ParentTeam', 'Parent team integration test');
    parentBuilder.set_coordinator(parentCoordinatorConfig);
    parentBuilder.add_sub_team_node(subTeamConfig);
    team = parentBuilder.build();

    team.start();
    await wait_for_team_to_be_idle(team, 60.0);

    const stream = new AgentTeamEventStream(team);

    await team.post_message(
      new AgentInputUserMessage(
        `Use the write_file tool to write "${toolArgs.content}" to "${toolArgs.path}". ` +
          'Do not respond with plain text.'
      ),
      'SubTeam'
    );

    const filePath = path.join(tempDirSubCoordinator, toolArgs.path);
    const created = await waitForFile(filePath, 20000, 100);
    expect(created).toBe(true);

    await wait_for_team_to_be_idle(team, 120.0);

    const events = await collectEvents(stream, 12000);
    await stream.close();

    const subTeamEvents = events.filter((event) => event.event_source_type === 'SUB_TEAM');
    expect(subTeamEvents.length).toBeGreaterThan(0);
  }, 60000);
});
