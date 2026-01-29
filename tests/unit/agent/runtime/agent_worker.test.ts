import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentWorker } from '../../../../src/agent/runtime/agent_worker.js';
import { AgentInputEventQueueManager } from '../../../../src/agent/events/agent_input_event_queue_manager.js';
import { AgentRuntimeState } from '../../../../src/agent/context/agent_runtime_state.js';
import { AgentConfig } from '../../../../src/agent/context/agent_config.js';
import { AgentContext } from '../../../../src/agent/context/agent_context.js';
import { AgentStatus } from '../../../../src/agent/status/status_enum.js';
import { AgentStatusDeriver } from '../../../../src/agent/status/status_deriver.js';
import { UserMessageReceivedEvent, BootstrapStartedEvent } from '../../../../src/agent/events/agent_events.js';
import { CompleteResponse } from '../../../../src/llm/utils/response_types.js';
import { BaseLLM } from '../../../../src/llm/base.js';
import { LLMModel } from '../../../../src/llm/models.js';
import { LLMProvider } from '../../../../src/llm/providers.js';
import { LLMConfig } from '../../../../src/llm/utils/llm_config.js';
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
  const context = new AgentContext('agent-1', config, state);

  context.state.status_manager_ref = { emit_status_update: vi.fn(async () => undefined) } as any;
  context.state.status_deriver = new AgentStatusDeriver(AgentStatus.BOOTSTRAPPING);
  return context;
};

describe('AgentWorker', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('initializes with context and dispatcher', () => {
    const context = makeContext();
    const worker = new AgentWorker(context, { get_handler: vi.fn() } as any);

    expect(worker.context).toBe(context);
    expect(worker.is_alive()).toBe(false);
    expect(worker.status_manager).toBe(context.status_manager);
  });

  it('start/stop lifecycle toggles is_alive', async () => {
    const context = makeContext();
    context.state.input_event_queues = new AgentInputEventQueueManager();
    const worker = new AgentWorker(context, { get_handler: vi.fn() } as any);

    vi.spyOn(worker as any, '_initialize').mockResolvedValue(true as any);

    worker.start();
    await new Promise((r) => setTimeout(r, 10));
    expect(worker.is_alive()).toBe(true);

    await worker.stop(0.5);
    expect(worker.is_alive()).toBe(false);
  });

  it('initialize succeeds when bootstrap reaches IDLE', async () => {
    const context = makeContext();
    const inputQueues = {
      enqueue_internal_system_event: vi.fn(async () => undefined),
      get_next_internal_event: vi.fn(async () => {
        if (!(getNext as any).yielded) {
          (getNext as any).yielded = true;
          return ['internal_system_event_queue', new UserMessageReceivedEvent({} as any)];
        }
        await new Promise((r) => setTimeout(r, 5));
        return null;
      })
    } as any;
    const getNext = inputQueues.get_next_internal_event;
    context.state.input_event_queues = inputQueues;

    const worker = new AgentWorker(context, { get_handler: vi.fn() } as any);
    worker.worker_event_dispatcher.dispatch = vi.fn(async (_event, ctx) => {
      ctx.current_status = AgentStatus.IDLE;
      ctx.state.status_deriver = new AgentStatusDeriver(AgentStatus.IDLE);
    });

    const success = await (worker as any)._initialize();

    expect(success).toBe(true);
    expect(inputQueues.enqueue_internal_system_event).toHaveBeenCalled();
    expect(inputQueues.enqueue_internal_system_event.mock.calls[0][0]).toBeInstanceOf(BootstrapStartedEvent);
  });

  it('initialize fails when bootstrap reaches ERROR', async () => {
    const context = makeContext();
    const inputQueues = {
      enqueue_internal_system_event: vi.fn(async () => undefined),
      get_next_internal_event: vi.fn(async () => {
        if (!(getNext as any).yielded) {
          (getNext as any).yielded = true;
          return ['internal_system_event_queue', new UserMessageReceivedEvent({} as any)];
        }
        await new Promise((r) => setTimeout(r, 5));
        return null;
      })
    } as any;
    const getNext = inputQueues.get_next_internal_event;
    context.state.input_event_queues = inputQueues;

    const worker = new AgentWorker(context, { get_handler: vi.fn() } as any);
    worker.worker_event_dispatcher.dispatch = vi.fn(async (_event, ctx) => {
      ctx.current_status = AgentStatus.ERROR;
      ctx.state.status_deriver = new AgentStatusDeriver(AgentStatus.ERROR);
    });

    const success = await (worker as any)._initialize();

    expect(success).toBe(false);
    expect(inputQueues.enqueue_internal_system_event).toHaveBeenCalled();
    expect(inputQueues.enqueue_internal_system_event.mock.calls[0][0]).toBeInstanceOf(BootstrapStartedEvent);
  });

  it('processes events from queue', async () => {
    const context = makeContext();
    const inputQueues = {
      enqueue_internal_system_event: vi.fn(async () => undefined),
      get_next_input_event: vi.fn(async () => {
        if (!(getNext as any).yielded) {
          (getNext as any).yielded = true;
          return ['user_message_input_queue', new UserMessageReceivedEvent({} as any)];
        }
        await new Promise((r) => setTimeout(r, 20));
        return null;
      })
    } as any;
    const getNext = inputQueues.get_next_input_event;
    context.state.input_event_queues = inputQueues;

    const worker = new AgentWorker(context, { get_handler: vi.fn() } as any);
    vi.spyOn(worker as any, '_initialize').mockResolvedValue(true as any);
    worker.worker_event_dispatcher.dispatch = vi.fn(async () => undefined);

    worker.start();
    await new Promise((r) => setTimeout(r, 30));

    expect(worker.worker_event_dispatcher.dispatch).toHaveBeenCalled();
    await worker.stop(0.2);
  });

  it('stops when dispatcher throws', async () => {
    const context = makeContext();
    const inputQueues = {
      get_next_input_event: vi.fn(async () => ['user_message_input_queue', new UserMessageReceivedEvent({} as any)])
    } as any;
    context.state.input_event_queues = inputQueues;

    const worker = new AgentWorker(context, { get_handler: vi.fn() } as any);
    vi.spyOn(worker as any, '_initialize').mockResolvedValue(true as any);
    worker.worker_event_dispatcher.dispatch = vi.fn(async () => {
      throw new Error('Dispatcher failed');
    });

    worker.start();
    await new Promise((r) => setTimeout(r, 20));

    expect(worker.is_alive()).toBe(false);
  });
});
