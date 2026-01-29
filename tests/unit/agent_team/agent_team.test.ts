import { describe, it, expect, vi } from 'vitest';
import { AgentTeam } from '../../../src/agent_team/agent_team.js';
import { ProcessUserMessageEvent } from '../../../src/agent_team/events/agent_team_events.js';
import { AgentInputUserMessage } from '../../../src/agent/message/agent_input_user_message.js';

const makeRuntime = () => {
  const mockContext = {
    config: { coordinator_node: { name: 'Coordinator' } },
    team_id: 'mock-team-id'
  };

  return {
    context: mockContext,
    is_running: false,
    start: vi.fn(),
    submit_event: vi.fn(async () => undefined)
  } as any;
};

describe('AgentTeam', () => {
  it('post_message starts if not running', async () => {
    const runtime = makeRuntime();
    runtime.is_running = false;
    const team = new AgentTeam(runtime);
    const message = new AgentInputUserMessage('test');

    await team.post_message(message);

    expect(runtime.start).toHaveBeenCalledOnce();
    expect(runtime.submit_event).toHaveBeenCalledOnce();
  });

  it('post_message defaults to coordinator', async () => {
    const runtime = makeRuntime();
    runtime.is_running = true;
    const team = new AgentTeam(runtime);
    const message = new AgentInputUserMessage('test');

    await team.post_message(message, null);

    const submittedEvent = runtime.submit_event.mock.calls[0][0];
    expect(submittedEvent).toBeInstanceOf(ProcessUserMessageEvent);
    expect(submittedEvent.user_message).toBe(message);
    expect(submittedEvent.target_agent_name).toBe('Coordinator');
  });

  it('post_message uses provided target', async () => {
    const runtime = makeRuntime();
    runtime.is_running = true;
    const team = new AgentTeam(runtime);
    const message = new AgentInputUserMessage('test');

    await team.post_message(message, 'Specialist');

    const submittedEvent = runtime.submit_event.mock.calls[0][0];
    expect(submittedEvent).toBeInstanceOf(ProcessUserMessageEvent);
    expect(submittedEvent.target_agent_name).toBe('Specialist');
  });
});
