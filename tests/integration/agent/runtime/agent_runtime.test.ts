import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentFactory } from '../../../../src/agent/factory/agent_factory.js';
import { AgentConfig } from '../../../../src/agent/context/agent_config.js';
import { AgentRuntimeState } from '../../../../src/agent/context/agent_runtime_state.js';
import { AgentContext } from '../../../../src/agent/context/agent_context.js';
import { AgentRuntime } from '../../../../src/agent/runtime/agent_runtime.js';
import { AgentStatus } from '../../../../src/agent/status/status_enum.js';
import { BaseLLM } from '../../../../src/llm/base.js';
import { LLMModel } from '../../../../src/llm/models.js';
import { LLMProvider } from '../../../../src/llm/providers.js';
import { LLMConfig } from '../../../../src/llm/utils/llm_config.js';
import { CompleteResponse } from '../../../../src/llm/utils/response_types.js';
import { SkillRegistry } from '../../../../src/skills/registry.js';
import type { LLMUserMessage } from '../../../../src/llm/user_message.js';
import type { ChunkResponse } from '../../../../src/llm/utils/response_types.js';

class DummyLLM extends BaseLLM {
  protected async _sendUserMessageToLLM(_userMessage: LLMUserMessage): Promise<CompleteResponse> {
    return new CompleteResponse({ content: 'ok' });
  }

  protected async *_streamUserMessageToLLM(
    _userMessage: LLMUserMessage
  ): AsyncGenerator<ChunkResponse, void, unknown> {
    yield { content: 'ok', is_complete: true } as ChunkResponse;
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForStatus = async (
  context: AgentContext,
  predicate: (status: AgentStatus) => boolean,
  timeoutMs = 8000,
  intervalMs = 25
): Promise<boolean> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate(context.current_status)) {
      return true;
    }
    await delay(intervalMs);
  }
  return false;
};

const resetFactory = () => {
  (AgentFactory as any).instance = undefined;
};

const createDummyConfig = () => {
  const model = new LLMModel({
    name: 'dummy',
    value: 'dummy',
    canonical_name: 'dummy',
    provider: LLMProvider.OPENAI
  });
  const llm = new DummyLLM(model, new LLMConfig());
  return new AgentConfig('RuntimeTestAgent', 'Tester', 'Runtime integration test agent', llm);
};

describe('Agent runtime integration', () => {
  beforeEach(() => {
    SkillRegistry.getInstance().clear();
    resetFactory();
  });

  afterEach(() => {
    SkillRegistry.getInstance().clear();
    resetFactory();
  });

  it('starts and stops AgentRuntime cleanly', async () => {
    const config = createDummyConfig();
    const agentId = `runtime_${Date.now()}`;

    const state = new AgentRuntimeState(agentId, null, null, null);
    state.llm_instance = config.llm_instance;
    state.tool_instances = {};

    const context = new AgentContext(agentId, config, state);
    const factory = new AgentFactory();
    const registry = (factory as any)._get_default_event_handler_registry();

    const runtime = new AgentRuntime(context, registry);

    try {
      expect(runtime.is_running).toBe(false);
      runtime.start();

      const ready = await waitForStatus(
        context,
        (status) => status === AgentStatus.IDLE || status === AgentStatus.ERROR
      );
      expect(ready).toBe(true);
      expect(context.current_status).toBe(AgentStatus.IDLE);

      await runtime.stop(5);
      const stopped = await waitForStatus(
        context,
        (status) => status === AgentStatus.SHUTDOWN_COMPLETE || status === AgentStatus.ERROR,
        5000
      );
      expect(stopped).toBe(true);
      expect(context.current_status).toBe(AgentStatus.SHUTDOWN_COMPLETE);
      expect(runtime.is_running).toBe(false);
    } finally {
      if (runtime.is_running) {
        await runtime.stop(2);
      }
      await config.llm_instance.cleanup();
    }
  }, 20000);

  it('Agent facade delegates start/stop to runtime', async () => {
    const config = createDummyConfig();
    const factory = new AgentFactory();
    const agent = factory.create_agent(config);

    try {
      expect(agent.is_running).toBe(false);
      agent.start();

      const ready = await waitForStatus(
        agent.context,
        (status) => status === AgentStatus.IDLE || status === AgentStatus.ERROR
      );
      expect(ready).toBe(true);
      expect(agent.context.current_status).toBe(AgentStatus.IDLE);
      expect(agent.is_running).toBe(true);

      await agent.stop(5);
      const stopped = await waitForStatus(
        agent.context,
        (status) => status === AgentStatus.SHUTDOWN_COMPLETE || status === AgentStatus.ERROR,
        5000
      );
      expect(stopped).toBe(true);
      expect(agent.context.current_status).toBe(AgentStatus.SHUTDOWN_COMPLETE);
      expect(agent.is_running).toBe(false);
    } finally {
      if (agent.is_running) {
        await agent.stop(2);
      }
      await config.llm_instance.cleanup();
    }
  }, 20000);
});
