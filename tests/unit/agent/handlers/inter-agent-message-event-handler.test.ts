import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InterAgentMessageReceivedEventHandler } from '../../../../src/agent/handlers/inter-agent-message-event-handler.js';
import {
  InterAgentMessageReceivedEvent,
  GenericEvent,
  UserMessageReceivedEvent
} from '../../../../src/agent/events/agent-events.js';
import { InterAgentMessage } from '../../../../src/agent/message/inter-agent-message.js';
import { InterAgentMessageType } from '../../../../src/agent/message/inter-agent-message-type.js';
import { AgentInputUserMessage } from '../../../../src/agent/message/agent-input-user-message.js';
import { AgentContext } from '../../../../src/agent/context/agent-context.js';
import { AgentConfig } from '../../../../src/agent/context/agent-config.js';
import { AgentRuntimeState } from '../../../../src/agent/context/agent-runtime-state.js';
import { BaseLLM } from '../../../../src/llm/base.js';
import { LLMModel } from '../../../../src/llm/models.js';
import { LLMProvider } from '../../../../src/llm/providers.js';
import { LLMConfig } from '../../../../src/llm/utils/llm-config.js';
import { CompleteResponse, ChunkResponse } from '../../../../src/llm/utils/response-types.js';
import { LLMUserMessage } from '../../../../src/llm/user-message.js';

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
    canonicalName: 'dummy',
    provider: LLMProvider.OPENAI
  });
  const llm = new DummyLLM(model, new LLMConfig());
  const config = new AgentConfig('name', 'role', 'desc', llm);
  const state = new AgentRuntimeState('agent-1');
  const inputQueues = { enqueueUserMessage: vi.fn(async () => undefined) } as any;
  state.inputEventQueues = inputQueues;
  const notifier = {
    notifyAgentDataInterAgentMessageReceived: vi.fn()
  };
  state.statusManagerRef = { notifier } as any;
  const context = new AgentContext('agent-1', config, state);
  return { context, inputQueues, notifier };
};

describe('InterAgentMessageReceivedEventHandler', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('handles inter-agent messages', async () => {
    const handler = new InterAgentMessageReceivedEventHandler();
    const { context, inputQueues, notifier } = makeContext();
    const senderId = 'sender_agent_123';
    const content = 'This is a test message from another agent.';
    const messageType = InterAgentMessageType.TASK_ASSIGNMENT;
    const recipientRole = context.config.role;

    const interAgentMsg = new InterAgentMessage(
      recipientRole,
      context.agentId,
      content,
      messageType,
      senderId
    );
    const event = new InterAgentMessageReceivedEvent(interAgentMsg);

    await handler.handle(event, context);

    expect(
      infoSpy.mock.calls.some(([msg]: [unknown]) =>
        String(msg).includes(
          `Agent 'agent-1' handling InterAgentMessageReceivedEvent from sender '${senderId}', type '${messageType.value}'. Content: '${content}'`
        )
      )
    ).toBe(true);
    expect(notifier.notifyAgentDataInterAgentMessageReceived).toHaveBeenCalledWith({
      sender_agent_id: senderId,
      recipient_role_name: recipientRole,
      content,
      message_type: messageType.value
    });

    expect(inputQueues.enqueueUserMessage).toHaveBeenCalledTimes(1);
    const enqueued = inputQueues.enqueueUserMessage.mock.calls[0][0];
    expect(enqueued).toBeInstanceOf(UserMessageReceivedEvent);
    expect(enqueued.agentInputUserMessage).toBeInstanceOf(AgentInputUserMessage);
    const contentSent = enqueued.agentInputUserMessage.content;
    expect(contentSent).toContain(`Sender Agent ID: ${senderId}`);
    expect(contentSent).toContain(`Message Type: ${messageType.value}`);
    expect(contentSent).toContain(`--- Message Content ---\n${content}`);
  });

  it('skips invalid event types', async () => {
    const handler = new InterAgentMessageReceivedEventHandler();
    const { context, inputQueues } = makeContext();
    const invalidEvent = new GenericEvent({ data: 'test' }, 'wrong_event');

    await handler.handle(invalidEvent as any, context);

    expect(
      warnSpy.mock.calls.some(([msg]: [unknown]) =>
        String(msg).includes(
          'InterAgentMessageReceivedEventHandler received an event of type GenericEvent instead of InterAgentMessageReceivedEvent. Skipping.'
        )
      )
    ).toBe(true);
    expect(inputQueues.enqueueUserMessage).not.toHaveBeenCalled();
  });

  it('logs initialization', () => {
    new InterAgentMessageReceivedEventHandler();
    expect(
      infoSpy.mock.calls.some(([msg]: [unknown]) =>
        String(msg).includes('InterAgentMessageReceivedEventHandler initialized.')
      )
    ).toBe(true);
  });
});
