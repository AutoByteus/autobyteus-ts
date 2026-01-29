import { describe, it, expect } from 'vitest';
import { AgentInputEventQueueManager } from '../../../../src/agent/events/agent_input_event_queue_manager.js';
import { PendingToolInvocationEvent, ToolResultEvent } from '../../../../src/agent/events/agent_events.js';
import { ToolInvocation } from '../../../../src/agent/tool_invocation.js';

describe('AgentInputEventQueueManager', () => {
  it('preserves FIFO order when only tool queue has items', async () => {
    const mgr = new AgentInputEventQueueManager();

    await mgr.tool_invocation_request_queue.put(
      new PendingToolInvocationEvent(new ToolInvocation('tool_1', {}, 't1'))
    );
    await mgr.tool_invocation_request_queue.put(
      new PendingToolInvocationEvent(new ToolInvocation('tool_2', {}, 't2'))
    );

    const evt1 = await mgr.get_next_input_event();
    const evt2 = await mgr.get_next_input_event();

    expect(evt1).not.toBeNull();
    expect(evt2).not.toBeNull();

    const [, e1] = evt1!;
    const [, e2] = evt2!;

    expect((e1 as PendingToolInvocationEvent).tool_invocation.id).toBe('t1');
    expect((e2 as PendingToolInvocationEvent).tool_invocation.id).toBe('t2');
  });

  it('buffers multiple ready queues without reordering tool invocations', async () => {
    const mgr = new AgentInputEventQueueManager();

    await mgr.tool_invocation_request_queue.put(
      new PendingToolInvocationEvent(new ToolInvocation('tool_1', {}, 't1'))
    );
    await mgr.tool_invocation_request_queue.put(
      new PendingToolInvocationEvent(new ToolInvocation('tool_2', {}, 't2'))
    );

    await mgr.tool_result_input_queue.put(new ToolResultEvent('other_tool', 'ok'));

    const evt1 = await mgr.get_next_input_event();
    const evt2 = await mgr.get_next_input_event();
    const evt3 = await mgr.get_next_input_event();

    expect(evt1).not.toBeNull();
    expect(evt2).not.toBeNull();
    expect(evt3).not.toBeNull();

    const [, e1] = evt1!;
    const [, e2] = evt2!;
    const [, e3] = evt3!;

    expect(e1).toBeInstanceOf(PendingToolInvocationEvent);
    expect((e1 as PendingToolInvocationEvent).tool_invocation.id).toBe('t1');
    expect(e2).toBeInstanceOf(ToolResultEvent);
    expect(e3).toBeInstanceOf(PendingToolInvocationEvent);
    expect((e3 as PendingToolInvocationEvent).tool_invocation.id).toBe('t2');
  });
});
