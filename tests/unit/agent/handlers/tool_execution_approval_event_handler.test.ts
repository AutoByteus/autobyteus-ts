import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ToolExecutionApprovalEventHandler } from '../../../../src/agent/handlers/tool_execution_approval_event_handler.js';
import {
  ToolExecutionApprovalEvent,
  ApprovedToolInvocationEvent,
  LLMUserMessageReadyEvent,
  GenericEvent
} from '../../../../src/agent/events/agent_events.js';
import { ToolInvocation } from '../../../../src/agent/tool_invocation.js';
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
  const context = new AgentContext('agent-1', config, state);
  return { context, inputQueues };
};

describe('ToolExecutionApprovalEventHandler', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    debugSpy.mockRestore();
  });

  it('handles tool approval', async () => {
    const handler = new ToolExecutionApprovalEventHandler();
    const { context, inputQueues } = makeContext();
    const invocation = new ToolInvocation('mock_tool', { arg1: 'value1' }, 'test_tool_invocation_id');
    vi.spyOn(context.state, 'retrieve_pending_tool_invocation').mockReturnValue(invocation);

    const event = new ToolExecutionApprovalEvent('test_tool_invocation_id', true, 'User approved');
    await handler.handle(event, context);

    expect(
      infoSpy.mock.calls.some(([msg]: [unknown]) =>
        String(msg).includes(
          "handling ToolExecutionApprovalEvent for tool_invocation_id 'test_tool_invocation_id': Approved=true"
        )
      )
    ).toBe(true);
    expect(
      infoSpy.mock.calls.some(([msg]: [unknown]) =>
        String(msg).includes(
          "Tool invocation 'mock_tool' (ID: test_tool_invocation_id) was APPROVED. Reason: 'User approved'."
        )
      )
    ).toBe(true);

    expect(context.state.retrieve_pending_tool_invocation).toHaveBeenCalledWith('test_tool_invocation_id');
    expect(inputQueues.enqueue_internal_system_event).toHaveBeenCalledTimes(1);
    const enqueued = inputQueues.enqueue_internal_system_event.mock.calls[0][0];
    expect(enqueued).toBeInstanceOf(ApprovedToolInvocationEvent);
    expect(enqueued.tool_invocation).toBe(invocation);
  });

  it('handles tool denial with reason', async () => {
    const handler = new ToolExecutionApprovalEventHandler();
    const { context, inputQueues } = makeContext();
    const invocation = new ToolInvocation('mock_tool', { arg1: 'value1' }, 'test_tool_invocation_id');
    vi.spyOn(context.state, 'retrieve_pending_tool_invocation').mockReturnValue(invocation);
    const historySpy = vi.spyOn(context.state, 'add_message_to_history');

    const denialReason = 'User denied due to cost.';
    const event = new ToolExecutionApprovalEvent('test_tool_invocation_id', false, denialReason);
    await handler.handle(event, context);

    expect(
      warnSpy.mock.calls.some(([msg]: [unknown]) =>
        String(msg).includes("Tool invocation 'mock_tool' (ID: test_tool_invocation_id) was DENIED. Reason: 'User denied due to cost.'.")
      )
    ).toBe(true);

    expect(context.state.retrieve_pending_tool_invocation).toHaveBeenCalledWith('test_tool_invocation_id');
    expect(historySpy).toHaveBeenCalledWith({
      role: 'tool',
      tool_call_id: 'test_tool_invocation_id',
      name: 'mock_tool',
      content: `Tool execution denied by user/system. Reason: ${denialReason}`
    });

    expect(inputQueues.enqueue_internal_system_event).toHaveBeenCalledTimes(1);
    const enqueued = inputQueues.enqueue_internal_system_event.mock.calls[0][0];
    expect(enqueued).toBeInstanceOf(LLMUserMessageReadyEvent);
    expect(enqueued.llm_user_message).toBeInstanceOf(LLMUserMessage);
    expect(enqueued.llm_user_message.content).toContain(
      "The request to use the tool 'mock_tool' (with arguments: {\"arg1\":\"value1\"}) was denied."
    );
    expect(enqueued.llm_user_message.content).toContain(`Denial reason: '${denialReason}'.`);
  });

  it('handles tool denial with no reason', async () => {
    const handler = new ToolExecutionApprovalEventHandler();
    const { context, inputQueues } = makeContext();
    const invocation = new ToolInvocation('mock_tool', { arg1: 'value1' }, 'test_tool_invocation_id');
    vi.spyOn(context.state, 'retrieve_pending_tool_invocation').mockReturnValue(invocation);
    const historySpy = vi.spyOn(context.state, 'add_message_to_history');

    const event = new ToolExecutionApprovalEvent('test_tool_invocation_id', false);
    await handler.handle(event, context);

    expect(historySpy).toHaveBeenCalledWith({
      role: 'tool',
      tool_call_id: 'test_tool_invocation_id',
      name: 'mock_tool',
      content: 'Tool execution denied by user/system. Reason: No specific reason provided.'
    });

    const enqueued = inputQueues.enqueue_internal_system_event.mock.calls[0][0];
    expect(enqueued.llm_user_message.content).toContain("Denial reason: 'No specific reason provided.'.");
  });

  it('handles missing pending invocation', async () => {
    const handler = new ToolExecutionApprovalEventHandler();
    const { context, inputQueues } = makeContext();
    vi.spyOn(context.state, 'retrieve_pending_tool_invocation').mockReturnValue(undefined);

    const event = new ToolExecutionApprovalEvent('unknown-id-000', true);
    await handler.handle(event, context);

    expect(
      warnSpy.mock.calls.some(([msg]: [unknown]) =>
        String(msg).includes("No pending tool invocation found for ID 'unknown-id-000'")
      )
    ).toBe(true);
    expect(inputQueues.enqueue_internal_system_event).not.toHaveBeenCalled();
  });

  it('skips invalid event type', async () => {
    const handler = new ToolExecutionApprovalEventHandler();
    const { context, inputQueues } = makeContext();
    const invalidEvent = new GenericEvent({}, 'some_other_event');

    await handler.handle(invalidEvent as any, context);

    expect(
      warnSpy.mock.calls.some(([msg]: [unknown]) =>
        String(msg).includes(
          'ToolExecutionApprovalEventHandler received non-ToolExecutionApprovalEvent: GenericEvent. Skipping.'
        )
      )
    ).toBe(true);
    expect(inputQueues.enqueue_internal_system_event).not.toHaveBeenCalled();
  });

  it('logs initialization', () => {
    new ToolExecutionApprovalEventHandler();
    expect(
      infoSpy.mock.calls.some(([msg]: [unknown]) =>
        String(msg).includes('ToolExecutionApprovalEventHandler initialized.')
      )
    ).toBe(true);
  });
});
