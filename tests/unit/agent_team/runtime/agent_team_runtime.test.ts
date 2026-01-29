import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  workerInstance: {
    start: vi.fn(),
    stop: vi.fn().mockResolvedValue(undefined),
    is_alive: vi.fn().mockReturnValue(false),
    add_done_callback: vi.fn(),
    get_worker_loop: vi.fn().mockReturnValue({})
  },
  statusManagerInstance: {
    emit_status_update: vi.fn(async () => undefined)
  }
}));

vi.mock('../../../../src/agent_team/runtime/agent_team_worker.js', () => {
  class MockAgentTeamWorker {
    start = mocks.workerInstance.start;
    stop = mocks.workerInstance.stop;
    is_alive = mocks.workerInstance.is_alive;
    add_done_callback = mocks.workerInstance.add_done_callback;
    get_worker_loop = mocks.workerInstance.get_worker_loop;
  }
  return { AgentTeamWorker: MockAgentTeamWorker };
});

vi.mock('../../../../src/agent_team/status/agent_team_status_manager.js', () => {
  class MockAgentTeamStatusManager {
    constructor() {
      return mocks.statusManagerInstance;
    }
  }
  return { AgentTeamStatusManager: MockAgentTeamStatusManager };
});

import { AgentTeamRuntime } from '../../../../src/agent_team/runtime/agent_team_runtime.js';
import { AgentTeamRuntimeState } from '../../../../src/agent_team/context/agent_team_runtime_state.js';
import { AgentTeamConfig } from '../../../../src/agent_team/context/agent_team_config.js';
import { AgentTeamContext } from '../../../../src/agent_team/context/agent_team_context.js';
import { TeamNodeConfig } from '../../../../src/agent_team/context/team_node_config.js';
import {
  AgentTeamShutdownRequestedEvent,
  AgentTeamStoppedEvent,
  AgentTeamErrorEvent,
  ProcessUserMessageEvent
} from '../../../../src/agent_team/events/agent_team_events.js';
import { AgentConfig } from '../../../../src/agent/context/agent_config.js';
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
  const agent = new AgentConfig('Coordinator', 'Coordinator', 'desc', llm);
  const node = new TeamNodeConfig({ node_definition: agent });
  const config = new AgentTeamConfig({
    name: 'Team',
    description: 'desc',
    nodes: [node],
    coordinator_node: node
  });
  const state = new AgentTeamRuntimeState({ team_id: 'team-1' });
  return new AgentTeamContext('team-1', config, state);
};

describe('AgentTeamRuntime', () => {
  beforeEach(() => {
    mocks.workerInstance.start.mockReset();
    mocks.workerInstance.stop.mockReset();
    mocks.workerInstance.is_alive.mockReset();
    mocks.workerInstance.add_done_callback.mockReset();
    mocks.workerInstance.get_worker_loop.mockReset();
    mocks.statusManagerInstance.emit_status_update.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes components and wires status manager', () => {
    const context = makeContext();
    const runtime = new AgentTeamRuntime(context, {} as any);

    expect(runtime.notifier.team_id).toBe(context.team_id);
    expect(runtime.status_manager).toBe(mocks.statusManagerInstance);
    expect(context.state.status_manager_ref).toBe(mocks.statusManagerInstance);
    expect(mocks.workerInstance.add_done_callback).toHaveBeenCalledOnce();
    expect(context.state.multiplexer_ref).toBe(runtime.multiplexer);
  });

  it('start delegates to worker', () => {
    const context = makeContext();
    const runtime = new AgentTeamRuntime(context, {} as any);

    mocks.workerInstance.is_alive.mockReturnValue(false);
    runtime.start();

    expect(mocks.workerInstance.start).toHaveBeenCalledOnce();
  });

  it('start is idempotent when worker alive', () => {
    const context = makeContext();
    const runtime = new AgentTeamRuntime(context, {} as any);

    mocks.workerInstance.is_alive.mockReturnValue(true);
    runtime.start();

    expect(mocks.workerInstance.start).not.toHaveBeenCalled();
  });

  it('stop runs full flow when worker alive', async () => {
    const context = makeContext();
    const runtime = new AgentTeamRuntime(context, {} as any);

    mocks.workerInstance.is_alive.mockReturnValue(true);
    runtime._apply_event_and_derive_status = vi.fn(async () => undefined) as any;

    await runtime.stop(0.1);

    expect(runtime._apply_event_and_derive_status).toHaveBeenCalledTimes(2);
    expect((runtime._apply_event_and_derive_status as any).mock.calls[0][0]).toBeInstanceOf(
      AgentTeamShutdownRequestedEvent
    );
    expect(mocks.workerInstance.stop).toHaveBeenCalledWith(0.1);
    expect((runtime._apply_event_and_derive_status as any).mock.calls[1][0]).toBeInstanceOf(
      AgentTeamStoppedEvent
    );
  });

  it('stop returns early when worker not alive', async () => {
    const context = makeContext();
    const runtime = new AgentTeamRuntime(context, {} as any);

    mocks.workerInstance.is_alive.mockReturnValue(false);
    runtime._apply_event_and_derive_status = vi.fn(async () => undefined) as any;

    await runtime.stop(0.1);

    expect(runtime._apply_event_and_derive_status).toHaveBeenCalledTimes(1);
    expect((runtime._apply_event_and_derive_status as any).mock.calls[0][0]).toBeInstanceOf(
      AgentTeamStoppedEvent
    );
    expect(mocks.workerInstance.stop).not.toHaveBeenCalled();
  });

  it('submit_event routes to correct queue', async () => {
    const context = makeContext();
    const runtime = new AgentTeamRuntime(context, {} as any);

    mocks.workerInstance.is_alive.mockReturnValue(true);

    const inputQueues = {
      enqueue_user_message: vi.fn(async () => undefined),
      enqueue_internal_system_event: vi.fn(async () => undefined)
    } as any;
    context.state.input_event_queues = inputQueues;

    const userEvent = new ProcessUserMessageEvent({} as any, 'Coordinator');
    await runtime.submit_event(userEvent);

    expect(inputQueues.enqueue_user_message).toHaveBeenCalledWith(userEvent);
    expect(inputQueues.enqueue_internal_system_event).not.toHaveBeenCalled();

    inputQueues.enqueue_user_message.mockClear();
    inputQueues.enqueue_internal_system_event.mockClear();

    const otherEvent = new AgentTeamErrorEvent('oops');
    await runtime.submit_event(otherEvent);

    expect(inputQueues.enqueue_user_message).not.toHaveBeenCalled();
    expect(inputQueues.enqueue_internal_system_event).toHaveBeenCalledWith(otherEvent);
  });

  it('handles worker completion with error', () => {
    const context = makeContext();
    const runtime = new AgentTeamRuntime(context, {} as any);
    runtime._apply_event_and_derive_status = vi.fn(async () => undefined) as any;

    (runtime as any)._handle_worker_completion({ status: 'rejected', reason: new Error('Worker crashed') } as any);

    expect(runtime._apply_event_and_derive_status).toHaveBeenCalledTimes(2);
    expect((runtime._apply_event_and_derive_status as any).mock.calls[0][0]).toBeInstanceOf(
      AgentTeamErrorEvent
    );
    expect((runtime._apply_event_and_derive_status as any).mock.calls[1][0]).toBeInstanceOf(
      AgentTeamStoppedEvent
    );
  });

  it('exposes is_running', () => {
    const context = makeContext();
    const runtime = new AgentTeamRuntime(context, {} as any);

    mocks.workerInstance.is_alive.mockReturnValue(true);
    expect(runtime.is_running).toBe(true);

    mocks.workerInstance.is_alive.mockReturnValue(false);
    expect(runtime.is_running).toBe(false);
  });
});
