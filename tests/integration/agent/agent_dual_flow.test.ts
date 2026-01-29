import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AgentFactory } from '../../../src/agent/factory/agent_factory.js';
import { AgentConfig } from '../../../src/agent/context/agent_config.js';
import { AgentStatus } from '../../../src/agent/status/status_enum.js';
import { AgentInputUserMessage } from '../../../src/agent/message/agent_input_user_message.js';
import { OpenAILLM } from '../../../src/llm/api/openai_llm.js';
import { LLMModel } from '../../../src/llm/models.js';
import { LLMProvider } from '../../../src/llm/providers.js';
import type { ChunkResponse } from '../../../src/llm/utils/response_types.js';
import type { LLMUserMessage } from '../../../src/llm/user_message.js';
import { registerWriteFileTool } from '../../../src/tools/file/write_file.js';
import { BaseAgentWorkspace } from '../../../src/agent/workspace/base_workspace.js';
import { WorkspaceConfig } from '../../../src/agent/workspace/workspace_config.js';
import { SkillRegistry } from '../../../src/skills/registry.js';

class SimpleWorkspace extends BaseAgentWorkspace {
  private rootPath: string;

  constructor(rootPath: string) {
    super(new WorkspaceConfig({ root_path: rootPath }));
    this.rootPath = rootPath;
  }

  get_base_path(): string {
    return this.rootPath;
  }

  // Tool compatibility: some tools expect camelCase.
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

const waitForStatus = async (
  agentId: string,
  getStatus: () => AgentStatus,
  timeoutMs = 8000,
  intervalMs = 25
): Promise<boolean> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = getStatus();
    if (status === AgentStatus.IDLE || status === AgentStatus.ERROR) {
      return true;
    }
    await delay(intervalMs);
  }
  console.warn(`Agent '${agentId}' did not reach IDLE/ERROR within ${timeoutMs}ms.`);
  return false;
};

const resetFactory = () => {
  (AgentFactory as any).instance = undefined;
};

const apiKey = process.env.OPENAI_API_KEY;
const runIntegration = apiKey ? describe : describe.skip;

runIntegration('Agent dual-flow integration (OpenAI, api_tool_call)', () => {
  let tempDirA: string;
  let tempDirB: string;
  let originalParserEnv: string | undefined;

  beforeEach(async () => {
    originalParserEnv = process.env.AUTOBYTEUS_STREAM_PARSER;
    process.env.AUTOBYTEUS_STREAM_PARSER = 'api_tool_call';
    SkillRegistry.getInstance().clear();
    resetFactory();
    tempDirA = await fs.mkdtemp(path.join(os.tmpdir(), 'autobyteus-agent-a-'));
    tempDirB = await fs.mkdtemp(path.join(os.tmpdir(), 'autobyteus-agent-b-'));
  });

  afterEach(async () => {
    if (originalParserEnv === undefined) {
      delete process.env.AUTOBYTEUS_STREAM_PARSER;
    } else {
      process.env.AUTOBYTEUS_STREAM_PARSER = originalParserEnv;
    }
    SkillRegistry.getInstance().clear();
    resetFactory();
    await fs.rm(tempDirA, { recursive: true, force: true });
    await fs.rm(tempDirB, { recursive: true, force: true });
  });

  it('runs two agents concurrently and executes tool calls', async () => {
    const tool = registerWriteFileTool();
    const toolArgsA = { path: 'alpha.txt', content: 'Alpha agent output.' };
    const toolArgsB = { path: 'beta.txt', content: 'Beta agent output.' };

    const model = new LLMModel({
      name: 'gpt-5.2',
      value: 'gpt-5.2',
      canonical_name: 'gpt-5.2',
      provider: LLMProvider.OPENAI
    });

    const llmA = new RequiredToolOpenAILLM(model);
    const llmB = new RequiredToolOpenAILLM(model);

    const configA = new AgentConfig(
      'DualAgentA',
      'Tester',
      'Dual agent flow A',
      llmA,
      null,
      [tool],
      true,
      null,
      null,
      null,
      null,
      null,
      new SimpleWorkspace(tempDirA)
    );

    const configB = new AgentConfig(
      'DualAgentB',
      'Tester',
      'Dual agent flow B',
      llmB,
      null,
      [tool],
      true,
      null,
      null,
      null,
      null,
      null,
      new SimpleWorkspace(tempDirB)
    );

    const factory = new AgentFactory();
    const agentA = factory.create_agent(configA);
    const agentB = factory.create_agent(configB);

    try {
      agentA.start();
      agentB.start();

      const [readyA, readyB] = await Promise.all([
        waitForStatus(agentA.agent_id, () => agentA.context.current_status),
        waitForStatus(agentB.agent_id, () => agentB.context.current_status)
      ]);
      expect(readyA).toBe(true);
      expect(readyB).toBe(true);

      await Promise.all([
        agentA.post_user_message(
          new AgentInputUserMessage(
            `Use the write_file tool to write "${toolArgsA.content}" to "${toolArgsA.path}". ` +
              `Do not respond with plain text.`
          )
        ),
        agentB.post_user_message(
          new AgentInputUserMessage(
            `Use the write_file tool to write "${toolArgsB.content}" to "${toolArgsB.path}". ` +
              `Do not respond with plain text.`
          )
        )
      ]);

      const filePathA = path.join(tempDirA, toolArgsA.path);
      const filePathB = path.join(tempDirB, toolArgsB.path);

      const [createdA, createdB] = await Promise.all([
        waitForFile(filePathA, 20000, 100),
        waitForFile(filePathB, 20000, 100)
      ]);
      expect(createdA).toBe(true);
      expect(createdB).toBe(true);

      const [contentA, contentB] = await Promise.all([
        fs.readFile(filePathA, 'utf8'),
        fs.readFile(filePathB, 'utf8')
      ]);

      expect(contentA.trim()).toBe(toolArgsA.content);
      expect(contentB.trim()).toBe(toolArgsB.content);
    } finally {
      if (agentA.is_running) {
        await agentA.stop(5);
      }
      if (agentB.is_running) {
        await agentB.stop(5);
      }
      await llmA.cleanup();
      await llmB.cleanup();
    }
  }, 120000);
});
