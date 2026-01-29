import { describe, it, expect } from 'vitest';
import { InterAgentMessageType } from '../../../../src/agent/message/inter_agent_message_type.js';

describe('InterAgentMessageType', () => {
  it('defines default message types', () => {
    expect(InterAgentMessageType.TASK_ASSIGNMENT.value).toBe('task_assignment');
    expect(InterAgentMessageType.TASK_RESULT.value).toBe('task_result');
    expect(InterAgentMessageType.ERROR.value).toBe('error');
  });

  it('adds a new message type dynamically', () => {
    const created = InterAgentMessageType.add_type('CUSTOM', 'custom');
    expect(created?.value).toBe('custom');
    const fetched = InterAgentMessageType.getByValue('custom');
    expect(fetched).toBe(created);
  });
});
