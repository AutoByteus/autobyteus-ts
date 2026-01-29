import { describe, it, expect } from 'vitest';
import {
  AgentErrorEvent,
  UserMessageReceivedEvent,
  ToolResultEvent,
  GenericEvent
} from '../../../../src/agent/events/agent_events.js';
import { AgentInputUserMessage } from '../../../../src/agent/message/agent_input_user_message.js';


describe('Agent events', () => {
  it('stores error event data', () => {
    const event = new AgentErrorEvent('boom', 'details');
    expect(event.error_message).toBe('boom');
    expect(event.exception_details).toBe('details');
  });

  it('stores user message payload', () => {
    const msg = new AgentInputUserMessage('hello');
    const event = new UserMessageReceivedEvent(msg);
    expect(event.agent_input_user_message).toBe(msg);
  });

  it('stores tool result data', () => {
    const event = new ToolResultEvent('tool', { ok: true }, 'inv-1', undefined, { arg: 1 });
    expect(event.tool_name).toBe('tool');
    expect(event.result).toEqual({ ok: true });
    expect(event.tool_invocation_id).toBe('inv-1');
    expect(event.tool_args).toEqual({ arg: 1 });
  });

  it('stores generic event data', () => {
    const event = new GenericEvent({ value: 1 }, 'custom');
    expect(event.payload).toEqual({ value: 1 });
    expect(event.type_name).toBe('custom');
  });
});
