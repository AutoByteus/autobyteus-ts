import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  workerInstance: {
    start: vi.fn(),
    stop: vi.fn().mockResolvedValue(undefined),
    is_alive: vi.fn().mockReturnValue(false),
    add_done_callback: vi.fn()
  },
  statusManagerInstance: {
    emit_status_update: vi.fn(async () => undefined)
  },
  registerContext: vi.fn(),
  unregisterContext: vi.fn()
}));

vi.mock('../../../../src/agent/runtime/agent_worker.js', () => {
  class MockAgentWorker {
    start = mocks.workerInstance.start;
    stop = mocks.workerInstance.stop;
    is_alive = mocks.workerInstance.is_alive;
    add_done_callback = mocks.workerInstance.add_done_callback;
  }
  return { AgentWorker: MockAgentWorker };
});

vi.mock('../../../../src/agent/status/manager.js', () => {
  class MockAgentStatusManager {
    constructor() {
      return mocks.statusManagerInstance;
    }
  }
  return { AgentStatusManager: MockAgentStatusManager };
});

vi.mock('../../../../src/agent/context/agent_context_registry.js', () => {
  class MockAgentContextRegistry {
    registerContext = mocks.registerContext;
    unregisterContext = mocks.unregisterContext;
  }
  return { AgentContextRegistry: MockAgentContextRegistry };
});

import { AgentRuntime } from '../../../../src/agent/runtime/agent_runtime.js';
import { AgentConfig } from '../../../../src/agent/context/agent_config.js';
import { AgentRuntimeState } from '../../../../src/agent/context/agent_runtime_state.js';
import { AgentContext } from '../../../../src/agent/context/agent_context.js';
import { AgentStatus } from '../../../../src/agent/status/status_enum.js';
import { ShutdownRequestedEvent, AgentStoppedEvent, AgentErrorEvent } from '../../../../src/agent/events/agent_events.js';
import { BaseLLM } from '../../../../src/llm/base.js';
import { LLMModel } from '../../../../src/llm/models.js';
import { LLMProvider } from '../../../../src/llm/providers.js';
import { LLMConfig } from '../../../../src/llm/utils/llm_config.js';
import { CompleteResponse } from '../../../../src/llm/utils/response_types.js';
import type { LLMUserMessage } from '../../../../src/llm/user_message.js';
import type { CompleteResponse as CompleteResponseType, ChunkResponse } from '../../../../src/llm/utils/response_types.js';

class DummyLLM extends BaseLLM {
  protected async _sendUserMessageToLLM(_userMessage: LLMUserMessage): Promise<CompleteResponseType> {
    return new CompleteResponse({ content: 'ok' });
  }

  protected async *_streamUserMessageToLLM(
    _userMessage: LLMUserMessage
  ): AsyncGenerator<ChunkResponse, void, unknown> {
    yield { content: 'ok', is_complete: true } as ChunkResponse;
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

describe('AgentRuntime', () => {
  beforeEach(() => {
    mocks.workerInstance.start.mockReset();
    mocks.workerInstance.stop.mockReset();
    mocks.workerInstance.is_alive.mockReset();
    mocks.workerInstance.add_done_callback.mockReset();
    mocks.registerContext.mockReset();
    mocks.unregisterContext.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes components and registers context', () => {
    const context = makeContext();
    const registry = {} as any;

    const runtime = new AgentRuntime(context, registry);

    expect(runtime.external_event_notifier.agent_id).toBe(context.agent_id);
    expect(runtime.status_manager).toBe(mocks.statusManagerInstance);
    expect(context.state.status_manager_ref).toBe(mocks.statusManagerInstance);
    expect(mocks.workerInstance.add_done_callback).toHaveBeenCalledOnce();
    expect(mocks.registerContext).toHaveBeenCalledWith(context);
  });

  it('start delegates to worker', () => {
    const context = makeContext();
    const runtime = new AgentRuntime(context, {} as any);

    mocks.workerInstance.is_alive.mockReturnValue(false);
    runtime.start();

    expect(mocks.workerInstance.start).toHaveBeenCalledOnce();
  });

  it('start is idempotent when worker alive', () => {
    const context = makeContext();
    const runtime = new AgentRuntime(context, {} as any);

    mocks.workerInstance.is_alive.mockReturnValue(true);
    runtime.start();

    expect(mocks.workerInstance.start).not.toHaveBeenCalled();
  });

  it('stop runs full flow when worker alive', async () => {
    const context = makeContext();
    const runtime = new AgentRuntime(context, {} as any);

    mocks.workerInstance.is_alive.mockReturnValue(true);
    runtime._apply_event_and_derive_status = vi.fn(async () => undefined) as any;

    await runtime.stop(0.1);

    expect(runtime._apply_event_and_derive_status).toHaveBeenCalledTimes(2);
    expect((runtime._apply_event_and_derive_status as any).mock.calls[0][0]).toBeInstanceOf(ShutdownRequestedEvent);
    expect(mocks.workerInstance.stop).toHaveBeenCalledWith(0.1);
    expect(mocks.unregisterContext).toHaveBeenCalledWith(context.agent_id);
    expect((runtime._apply_event_and_derive_status as any).mock.calls[1][0]).toBeInstanceOf(AgentStoppedEvent);
  });

  it('stop returns early when worker not alive', async () => {
    const context = makeContext();
    const runtime = new AgentRuntime(context, {} as any);

    mocks.workerInstance.is_alive.mockReturnValue(false);
    runtime._apply_event_and_derive_status = vi.fn(async () => undefined) as any;

    await runtime.stop(0.1);

    expect(runtime._apply_event_and_derive_status).toHaveBeenCalledTimes(1);
    expect((runtime._apply_event_and_derive_status as any).mock.calls[0][0]).toBeInstanceOf(AgentStoppedEvent);
    expect(mocks.workerInstance.stop).not.toHaveBeenCalled();
    expect(mocks.unregisterContext).not.toHaveBeenCalled();
  });

  it('handles worker completion with error', () => {
    const context = makeContext();
    const runtime = new AgentRuntime(context, {} as any);
    runtime._apply_event_and_derive_status = vi.fn(async () => undefined) as any;

    (runtime as any)._handle_worker_completion({ status: 'rejected', reason: new Error('Worker crashed') } as any);

    expect(runtime._apply_event_and_derive_status).toHaveBeenCalledTimes(2);
    expect((runtime._apply_event_and_derive_status as any).mock.calls[0][0]).toBeInstanceOf(AgentErrorEvent);
    expect((runtime._apply_event_and_derive_status as any).mock.calls[1][0]).toBeInstanceOf(AgentStoppedEvent);
  });

  it('exposes current_status_property and is_running', () => {
    const context = makeContext();
    const runtime = new AgentRuntime(context, {} as any);

    context.current_status = AgentStatus.IDLE;
    expect(runtime.current_status_property).toBe(AgentStatus.IDLE);

    mocks.workerInstance.is_alive.mockReturnValue(true);
    expect(runtime.is_running).toBe(true);

    mocks.workerInstance.is_alive.mockReturnValue(false);
    expect(runtime.is_running).toBe(false);
  });
});
