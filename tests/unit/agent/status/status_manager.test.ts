import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentStatusManager } from '../../../../src/agent/status/manager.js';
import { AgentStatus } from '../../../../src/agent/status/status_enum.js';
import { LifecycleEvent } from '../../../../src/agent/lifecycle/events.js';
import { AgentContext } from '../../../../src/agent/context/agent_context.js';
import { AgentConfig } from '../../../../src/agent/context/agent_config.js';
import { AgentRuntimeState } from '../../../../src/agent/context/agent_runtime_state.js';
import { BaseLLM } from '../../../../src/llm/base.js';
import { LLMModel } from '../../../../src/llm/models.js';
import { LLMProvider } from '../../../../src/llm/providers.js';
import { LLMConfig } from '../../../../src/llm/utils/llm_config.js';
import { CompleteResponse, ChunkResponse } from '../../../../src/llm/utils/response_types.js';
import { LLMUserMessage } from '../../../../src/llm/user_message.js';

class DummyLLM extends BaseLLM {
  protected async _sendUserMessageToLLM(_userMessage: LLMUserMessage): Promise<CompleteResponse> {
    return new CompleteResponse({ content: 'ok' });
  }

  protected async *_streamUserMessageToLLM(_userMessage: LLMUserMessage): AsyncGenerator<ChunkResponse, void, unknown> {
    yield new ChunkResponse({ content: 'ok', is_complete: true });
  }
}

const makeContext = () => {
  const model = new LLMModel({
    name: 'dummy',
    value: 'dummy',
    canonical_name: 'dummy',
    provider: LLMProvider.OPENAI
  });
  const llm = new DummyLLM(model, new LLMConfig());
  const config = new AgentConfig('name', 'role', 'desc', llm);
  const state = new AgentRuntimeState('agent-1');
  return new AgentContext('agent-1', config, state);
};

describe('AgentStatusManager', () => {
  let agent_context: AgentContext;

  beforeEach(() => {
    agent_context = makeContext();
  });

  it('does nothing when status does not change', async () => {
    const notifier = { notify_status_updated: vi.fn() };
    const manager = new AgentStatusManager(agent_context, notifier as any);

    const processor = {
      event: LifecycleEvent.AGENT_READY,
      get_order: () => 100,
      get_name: () => 'Processor',
      process: vi.fn(async () => undefined)
    };
    agent_context.config.lifecycle_processors = [processor as any];

    await manager.emit_status_update(AgentStatus.IDLE, AgentStatus.IDLE);

    expect((processor as any).process).not.toHaveBeenCalled();
    expect(notifier.notify_status_updated).not.toHaveBeenCalled();
  });

  it('runs lifecycle processors in order', async () => {
    const notifierCalls: any[] = [];
    const notifier = { notify_status_updated: (...args: any[]) => notifierCalls.push(args) };
    const manager = new AgentStatusManager(agent_context, notifier as any);

    const call_order: string[] = [];
    const processor_late = {
      event: LifecycleEvent.AGENT_READY,
      get_order: () => 200,
      get_name: () => 'Late',
      process: async () => call_order.push('late')
    };
    const processor_early = {
      event: LifecycleEvent.AGENT_READY,
      get_order: () => 100,
      get_name: () => 'Early',
      process: async () => call_order.push('early')
    };

    agent_context.config.lifecycle_processors = [processor_late as any, processor_early as any];

    await manager.emit_status_update(AgentStatus.BOOTSTRAPPING, AgentStatus.IDLE, { foo: 'bar' });

    expect(call_order).toEqual(['early', 'late']);
    expect(notifierCalls).toEqual([[AgentStatus.IDLE, AgentStatus.BOOTSTRAPPING, { foo: 'bar' }]]);
  });

  it('handles lifecycle processor errors', async () => {
    const notifierCalls: any[] = [];
    const notifier = { notify_status_updated: (...args: any[]) => notifierCalls.push(args) };
    const manager = new AgentStatusManager(agent_context, notifier as any);

    const processor = {
      event: LifecycleEvent.BEFORE_LLM_CALL,
      get_order: () => 100,
      get_name: () => 'Fails',
      process: async () => {
        throw new Error('boom');
      }
    };

    agent_context.config.lifecycle_processors = [processor as any];

    await manager.emit_status_update(AgentStatus.PROCESSING_USER_INPUT, AgentStatus.AWAITING_LLM_RESPONSE);

    expect(notifierCalls).toEqual([[AgentStatus.AWAITING_LLM_RESPONSE, AgentStatus.PROCESSING_USER_INPUT, null]]);
  });
});
