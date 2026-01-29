import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UserInputMessageEventHandler } from '../../../../src/agent/handlers/user_input_message_event_handler.js';
import { UserMessageReceivedEvent, LLMUserMessageReadyEvent, GenericEvent } from '../../../../src/agent/events/agent_events.js';
import { AgentInputUserMessage } from '../../../../src/agent/message/agent_input_user_message.js';
import { ContextFile } from '../../../../src/agent/message/context_file.js';
import { ContextFileType } from '../../../../src/agent/message/context_file_type.js';
import { SenderType, TASK_NOTIFIER_SENDER_ID } from '../../../../src/agent/sender_type.js';
import { AgentContext } from '../../../../src/agent/context/agent_context.js';
import { AgentConfig } from '../../../../src/agent/context/agent_config.js';
import { AgentRuntimeState } from '../../../../src/agent/context/agent_runtime_state.js';
import { BaseAgentUserInputMessageProcessor } from '../../../../src/agent/input_processor/base_user_input_processor.js';
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

  protected async *_streamUserMessageToLLM(
    _userMessage: LLMUserMessage
  ): AsyncGenerator<ChunkResponse, void, unknown> {
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
  const inputQueues = { enqueue_internal_system_event: vi.fn(async () => undefined) } as any;
  state.input_event_queues = inputQueues;
  return { context: new AgentContext('agent-1', config, state), inputQueues };
};

class MockInputProcessor extends BaseAgentUserInputMessageProcessor {
  async process(message: AgentInputUserMessage): Promise<AgentInputUserMessage> {
    message.content = `Processed: ${message.content}`;
    message.metadata['processed_by'] = this.get_name();
    return message;
  }
}

class AnotherMockInputProcessor extends BaseAgentUserInputMessageProcessor {
  async process(message: AgentInputUserMessage): Promise<AgentInputUserMessage> {
    message.content += ' [Another]';
    message.metadata['another_processed_by'] = this.get_name();
    return message;
  }
}

describe('UserInputMessageEventHandler', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    debugSpy.mockRestore();
  });

  it('handles user input with no processors', async () => {
    const handler = new UserInputMessageEventHandler();
    const { context, inputQueues } = makeContext();
    const imageUrl = 'http://example.com/image.jpg';
    const agentInput = new AgentInputUserMessage(
      'Hello, agent!',
      SenderType.USER,
      [new ContextFile(imageUrl, ContextFileType.IMAGE)],
      { user_id: 'user123' }
    );
    const event = new UserMessageReceivedEvent(agentInput);
    context.config.input_processors = [];

    await handler.handle(event, context);

    expect(
      infoSpy.mock.calls.some(([msg]: [unknown]) =>
        String(msg).includes(
          "Agent 'agent-1' handling UserMessageReceivedEvent (type: user): 'Hello, agent!'"
        )
      )
    ).toBe(true);
    expect(
      debugSpy.mock.calls.some(([msg]: [unknown]) =>
        String(msg).includes("Agent 'agent-1': No input processors configured in agent config.")
      )
    ).toBe(true);
    expect(
      infoSpy.mock.calls.some(([msg]: [unknown]) =>
        String(msg).includes(
          "Agent 'agent-1' processed AgentInputUserMessage and enqueued LLMUserMessageReadyEvent."
        )
      )
    ).toBe(true);

    expect(inputQueues.enqueue_internal_system_event).toHaveBeenCalledTimes(1);
    const enqueued = inputQueues.enqueue_internal_system_event.mock.calls[0][0];
    expect(enqueued).toBeInstanceOf(LLMUserMessageReadyEvent);
    expect(enqueued.llm_user_message).toBeInstanceOf(LLMUserMessage);
    expect(enqueued.llm_user_message.content).toBe('Hello, agent!');
    expect(enqueued.llm_user_message.image_urls).toEqual([imageUrl]);
  });

  it('handles user input with one processor', async () => {
    const handler = new UserInputMessageEventHandler();
    const { context, inputQueues } = makeContext();
    const event = new UserMessageReceivedEvent(new AgentInputUserMessage('Needs processing.', SenderType.USER));
    context.config.input_processors = [new MockInputProcessor()];

    await handler.handle(event, context);

    const enqueued = inputQueues.enqueue_internal_system_event.mock.calls[0][0];
    expect(enqueued).toBeInstanceOf(LLMUserMessageReadyEvent);
    expect(enqueued.llm_user_message.content).toBe('Processed: Needs processing.');
  });

  it('handles user input with multiple processors', async () => {
    const handler = new UserInputMessageEventHandler();
    const { context, inputQueues } = makeContext();
    const event = new UserMessageReceivedEvent(new AgentInputUserMessage('Sequential processing.'));
    context.config.input_processors = [new MockInputProcessor(), new AnotherMockInputProcessor()];

    await handler.handle(event, context);

    const enqueued = inputQueues.enqueue_internal_system_event.mock.calls[0][0];
    expect(enqueued.llm_user_message.content).toBe('Processed: Sequential processing. [Another]');
  });

  it('continues when a processor throws', async () => {
    const handler = new UserInputMessageEventHandler();
    const { context, inputQueues } = makeContext();
    const event = new UserMessageReceivedEvent(
      new AgentInputUserMessage('This will cause processor error.')
    );
    const errorProcessor = new MockInputProcessor();
    errorProcessor.process = vi.fn(async () => {
      throw new Error('Simulated processor error');
    });
    context.config.input_processors = [errorProcessor, new AnotherMockInputProcessor()];

    await handler.handle(event, context);

    expect(
      errorSpy.mock.calls.some(([msg]: [unknown]) =>
        String(msg).includes(
          "Error applying input processor 'MockInputProcessor': Error: Simulated processor error."
        )
      )
    ).toBe(true);
    expect(
      errorSpy.mock.calls.some(([msg]: [unknown]) =>
        String(msg).includes('Skipping this processor and continuing with message from before this processor.')
      )
    ).toBe(true);

    const enqueued = inputQueues.enqueue_internal_system_event.mock.calls[0][0];
    expect(enqueued.llm_user_message.content).toBe('This will cause processor error. [Another]');
  });

  it('skips invalid event type', async () => {
    const handler = new UserInputMessageEventHandler();
    const { context, inputQueues } = makeContext();
    const invalidEvent = new GenericEvent({}, 'some_other_event');

    await handler.handle(invalidEvent as any, context);

    expect(
      warnSpy.mock.calls.some(([msg]: [unknown]) =>
        String(msg).includes(
          'UserInputMessageEventHandler received non-UserMessageReceivedEvent: GenericEvent. Skipping.'
        )
      )
    ).toBe(true);
    expect(inputQueues.enqueue_internal_system_event).not.toHaveBeenCalled();
  });

  it('emits system notification for system sender', async () => {
    const handler = new UserInputMessageEventHandler();
    const { context, inputQueues } = makeContext();
    const systemNotification = new AgentInputUserMessage(
      'Your task is now ready.',
      SenderType.SYSTEM,
      null,
      { sender_id: TASK_NOTIFIER_SENDER_ID }
    );
    const event = new UserMessageReceivedEvent(systemNotification);
    const notifier = { notify_agent_data_system_task_notification_received: vi.fn() };
    (context as any).state.status_manager_ref = { notifier };
    context.config.input_processors = [];

    await handler.handle(event, context);

    expect(notifier.notify_agent_data_system_task_notification_received).toHaveBeenCalledWith({
      sender_id: TASK_NOTIFIER_SENDER_ID,
      content: 'Your task is now ready.'
    });
    expect(
      infoSpy.mock.calls.some(([msg]: [unknown]) =>
        String(msg).includes('emitted system task notification for TUI based on SYSTEM sender_type')
      )
    ).toBe(true);
    expect(inputQueues.enqueue_internal_system_event).toHaveBeenCalledTimes(1);
  });

  it('handles message from tool sender', async () => {
    const handler = new UserInputMessageEventHandler();
    const { context } = makeContext();
    const event = new UserMessageReceivedEvent(
      new AgentInputUserMessage('Tool result: 42', SenderType.TOOL)
    );
    context.config.input_processors = [];

    await handler.handle(event, context);

    expect(
      infoSpy.mock.calls.some(([msg]: [unknown]) =>
        String(msg).includes(
          "Agent 'agent-1' handling UserMessageReceivedEvent (type: tool): 'Tool result: 42'"
        )
      )
    ).toBe(true);
  });

  it('handles message from agent sender', async () => {
    const handler = new UserInputMessageEventHandler();
    const { context } = makeContext();
    const event = new UserMessageReceivedEvent(
      new AgentInputUserMessage('Hello from another agent.', SenderType.AGENT)
    );
    context.config.input_processors = [];

    await handler.handle(event, context);

    expect(
      infoSpy.mock.calls.some(([msg]: [unknown]) =>
        String(msg).includes(
          "Agent 'agent-1' handling UserMessageReceivedEvent (type: agent): 'Hello from another agent.'"
        )
      )
    ).toBe(true);
  });

  it('logs initialization', () => {
    new UserInputMessageEventHandler();
    expect(
      infoSpy.mock.calls.some(([msg]: [unknown]) =>
        String(msg).includes('UserInputMessageEventHandler initialized.')
      )
    ).toBe(true);
  });
});
