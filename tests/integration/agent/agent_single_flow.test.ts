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

const waitForFile = async (filePath: string, timeoutMs = 5000, intervalMs = 50): Promise<boolean> => {
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

runIntegration('Agent single-flow integration (OpenAI)', () => {
  let tempDir: string;
  let originalParserEnv: string | undefined;

  beforeEach(async () => {
    originalParserEnv = process.env.AUTOBYTEUS_STREAM_PARSER;
    process.env.AUTOBYTEUS_STREAM_PARSER = 'api_tool_call';
    SkillRegistry.getInstance().clear();
    resetFactory();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'autobyteus-agent-'));
  });

  afterEach(async () => {
    if (originalParserEnv === undefined) {
      delete process.env.AUTOBYTEUS_STREAM_PARSER;
    } else {
      process.env.AUTOBYTEUS_STREAM_PARSER = originalParserEnv;
    }
    SkillRegistry.getInstance().clear();
    resetFactory();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('executes a tool call end-to-end for a single agent', async () => {
    const workspace = new SimpleWorkspace(tempDir);
    const tool = registerWriteFileTool();
    const toolArgs = { path: 'poem.txt', content: 'Roses are red.' };

    const model = new LLMModel({
      name: 'gpt-5.2',
      value: 'gpt-5.2',
      canonical_name: 'gpt-5.2',
      provider: LLMProvider.OPENAI
    });
    const llm = new RequiredToolOpenAILLM(model);

    const config = new AgentConfig(
      'SingleAgent',
      'Tester',
      'Single agent end-to-end flow',
      llm,
      null,
      [tool],
      true,
      null,
      null,
      null,
      null,
      null,
      workspace
    );

    const factory = new AgentFactory();
    const agent = factory.create_agent(config);

    try {
      agent.start();
      const ready = await waitForStatus(agent.agent_id, () => agent.context.current_status);
      expect(ready).toBe(true);

      await agent.post_user_message(
        new AgentInputUserMessage(
          `Use the write_file tool to write "${toolArgs.content}" to "${toolArgs.path}". ` +
            `Do not respond with plain text.`
        )
      );

      const filePath = path.join(tempDir, toolArgs.path);
      const created = await waitForFile(filePath, 20000, 100);
      expect(created).toBe(true);

      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe(toolArgs.content);
    } finally {
      if (agent.is_running) {
        await agent.stop(5);
      }
      await llm.cleanup();
    }
  }, 120000);
});
