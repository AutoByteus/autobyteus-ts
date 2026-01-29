import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { AgentFactory } from '../../../src/agent/factory/agent_factory.js';
import { AgentConfig } from '../../../src/agent/context/agent_config.js';
import { PendingToolInvocationEvent, ToolResultEvent } from '../../../src/agent/events/agent_events.js';
import { ToolInvocation } from '../../../src/agent/tool_invocation.js';
import { wait_for_agent_to_be_idle } from '../../../src/agent/utils/wait_for_idle.js';
import { BaseAgentWorkspace } from '../../../src/agent/workspace/base_workspace.js';
import { WorkspaceConfig } from '../../../src/agent/workspace/workspace_config.js';
import { BaseLLM } from '../../../src/llm/base.js';
import { LLMModel } from '../../../src/llm/models.js';
import { LLMProvider } from '../../../src/llm/providers.js';
import { LLMConfig } from '../../../src/llm/utils/llm_config.js';
import { CompleteResponse, ChunkResponse } from '../../../src/llm/utils/response_types.js';
import type { LLMUserMessage } from '../../../src/llm/user_message.js';
import { defaultToolRegistry } from '../../../src/tools/registry/tool_registry.js';
import { registerWriteFileTool } from '../../../src/tools/file/write_file.js';
import { registerReadFileTool } from '../../../src/tools/file/read_file.js';
import { registerPatchFileTool } from '../../../src/tools/file/patch_file.js';
import { registerRunBashTool } from '../../../src/tools/terminal/tools/run_bash.js';
import { TerminalResult } from '../../../src/tools/terminal/types.js';

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

class TestWorkspace extends BaseAgentWorkspace {
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

type AgentFixture = {
  agent: ReturnType<AgentFactory['create_agent']>;
  llm: DummyLLM;
  workspaceDir: string;
};

const waitFor = async (
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 50,
  description = 'condition'
): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out waiting for ${description}.`);
};

const createAgentFixture = async (tools: any[]): Promise<AgentFixture> => {
  const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tool-approval-'));
  const workspace = new TestWorkspace(workspaceDir);
  const model = new LLMModel({
    name: 'dummy',
    value: 'dummy',
    canonical_name: 'dummy',
    provider: LLMProvider.OPENAI
  });
  const llm = new DummyLLM(model, new LLMConfig());
  const config = new AgentConfig(
    'ApprovalAgent',
    'Tester',
    'Tool approval integration test agent.',
    llm,
    null,
    tools,
    false,
    null,
    null,
    null,
    null,
    null,
    workspace
  );
  const agent = new AgentFactory().create_agent(config);
  agent.start();
  await wait_for_agent_to_be_idle(agent, 10);
  return { agent, llm, workspaceDir };
};

describe('Tool approval integration flow', () => {
  let fixture: AgentFixture | null = null;

  beforeEach(() => {
    defaultToolRegistry.clear();
  });

  afterEach(async () => {
    if (fixture) {
      await fixture.agent.stop(2);
      await fixture.llm.cleanup();
      await fs.rm(fixture.workspaceDir, { recursive: true, force: true });
      fixture = null;
    }
  });

  it('executes write_file after approval', async () => {
    const writeTool = registerWriteFileTool();
    fixture = await createAgentFixture([writeTool]);

    const relativePath = 'poem.txt';
    const content = 'hello from approval';
    const invocationId = `write-${Date.now()}`;
    const invocation = new ToolInvocation('write_file', { path: relativePath, content }, invocationId);

    await fixture.agent.context.input_event_queues.enqueue_internal_system_event(
      new PendingToolInvocationEvent(invocation)
    );

    await waitFor(
      () => Boolean(fixture!.agent.context.state.pending_tool_approvals[invocationId]),
      5000,
      50,
      'pending tool approval'
    );

    await fixture.agent.post_tool_execution_approval(invocationId, true, 'approved');

    const finalPath = path.join(fixture.workspaceDir, relativePath);
    await waitFor(
      async () => {
        try {
          const fileContent = await fs.readFile(finalPath, 'utf-8');
          return fileContent === content;
        } catch {
          return false;
        }
      },
      5000,
      50,
      'write_file execution'
    );

    const written = await fs.readFile(finalPath, 'utf-8');
    expect(written).toBe(content);
  });

  it('executes read_file after approval and records tool output', async () => {
    const readTool = registerReadFileTool();
    fixture = await createAgentFixture([readTool]);

    const relativePath = 'sample.txt';
    const fileContent = 'line1\nline2\n';
    await fs.writeFile(path.join(fixture.workspaceDir, relativePath), fileContent, 'utf-8');

    const invocationId = `read-${Date.now()}`;
    const invocation = new ToolInvocation('read_file', { path: relativePath }, invocationId);

    await fixture.agent.context.input_event_queues.enqueue_internal_system_event(
      new PendingToolInvocationEvent(invocation)
    );

    await waitFor(
      () => Boolean(fixture!.agent.context.state.pending_tool_approvals[invocationId]),
      5000,
      50,
      'pending tool approval'
    );

    await fixture.agent.post_tool_execution_approval(invocationId, true, 'approved');

    await waitFor(
      () =>
        fixture!.agent.context.conversation_history.some(
          (entry) => entry.role === 'tool' && String(entry.content).includes('1: line1')
        ),
      5000,
      50,
      'read_file tool output'
    );

    const lastToolEntry = fixture.agent.context.conversation_history.find(
      (entry) => entry.role === 'tool' && String(entry.content).includes('1: line1')
    );
    expect(lastToolEntry).toBeDefined();
  });

  it('executes patch_file after approval', async () => {
    const patchTool = registerPatchFileTool();
    fixture = await createAgentFixture([patchTool]);

    const relativePath = 'patch_target.txt';
    const initialContent = 'line1\nline2\nline3\n';
    const targetPath = path.join(fixture.workspaceDir, relativePath);
    await fs.writeFile(targetPath, initialContent, 'utf-8');

    const patch = `@@ -1,3 +1,3 @@
 line1
-line2
+line2 updated
 line3
`;

    const invocationId = `patch-${Date.now()}`;
    const invocation = new ToolInvocation('patch_file', { path: relativePath, patch }, invocationId);

    await fixture.agent.context.input_event_queues.enqueue_internal_system_event(
      new PendingToolInvocationEvent(invocation)
    );

    await waitFor(
      () => Boolean(fixture!.agent.context.state.pending_tool_approvals[invocationId]),
      5000,
      50,
      'pending tool approval'
    );

    await fixture.agent.post_tool_execution_approval(invocationId, true, 'approved');

    await waitFor(
      async () => {
        try {
          const content = await fs.readFile(targetPath, 'utf-8');
          return content.includes('line2 updated');
        } catch {
          return false;
        }
      },
      5000,
      50,
      'patch_file execution'
    );

    const patchedContent = await fs.readFile(targetPath, 'utf-8');
    expect(patchedContent).toBe('line1\nline2 updated\nline3\n');
  });

  it('executes run_bash after approval', async () => {
    const runBashTool = registerRunBashTool();
    fixture = await createAgentFixture([runBashTool]);

    const invocationId = `bash-${Date.now()}`;
    const invocation = new ToolInvocation(
      'run_bash',
      { command: "printf 'approval_ok'", timeout_seconds: 5 },
      invocationId
    );

    await fixture.agent.context.input_event_queues.enqueue_internal_system_event(
      new PendingToolInvocationEvent(invocation)
    );

    await waitFor(
      () => Boolean(fixture!.agent.context.state.pending_tool_approvals[invocationId]),
      5000,
      50,
      'pending tool approval'
    );

    await fixture.agent.post_tool_execution_approval(invocationId, true, 'approved');

    await waitFor(
      () => {
        const events = fixture!.agent.context.state.event_store?.all_events() ?? [];
        return events.some(
          (envelope) =>
            envelope.event instanceof ToolResultEvent &&
            envelope.event.tool_invocation_id === invocationId
        );
      },
      5000,
      50,
      'run_bash tool result'
    );

    const events = fixture.agent.context.state.event_store?.all_events() ?? [];
    const toolEvent = events.find(
      (envelope) =>
        envelope.event instanceof ToolResultEvent &&
        envelope.event.tool_invocation_id === invocationId
    );

    expect(toolEvent).toBeDefined();
    const result = (toolEvent as { event: ToolResultEvent }).event.result as TerminalResult;
    expect(result.stdout).toContain('approval_ok');
    expect(result.exit_code).toBe(0);
    expect(result.timed_out).toBe(false);
  });
});
