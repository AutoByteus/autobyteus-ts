import { describe, it, expect, vi } from 'vitest';
import { TaskActivator } from '../../../../src/agent_team/task_notification/task_activator.js';
import { ProcessUserMessageEvent } from '../../../../src/agent_team/events/agent_team_events.js';
import { AgentInputUserMessage } from '../../../../src/agent/message/agent_input_user_message.js';
import { TASK_NOTIFIER_SENDER_ID } from '../../../../src/agent/sender_type.js';

const makeTeamManager = () => {
  return {
    team_id: 'test_activator_team',
    ensure_node_is_ready: vi.fn(async () => undefined),
    dispatch_user_message_to_agent: vi.fn(async () => undefined)
  };
};

describe('TaskActivator', () => {
  it('initializes with valid manager', () => {
    const manager = makeTeamManager();
    const activator = new TaskActivator(manager as any);
    expect(activator._team_manager).toBe(manager as any);
  });

  it('throws when manager is missing', () => {
    expect(() => new TaskActivator(null as any)).toThrow('TaskActivator requires a valid TeamManager instance.');
  });

  it('activates agent and dispatches message', async () => {
    const manager = makeTeamManager();
    const activator = new TaskActivator(manager as any);
    const agent_name = 'AgentToActivate';

    await activator.activate_agent(agent_name);

    expect(manager.ensure_node_is_ready).toHaveBeenCalledWith(agent_name);
    expect(manager.dispatch_user_message_to_agent).toHaveBeenCalledTimes(1);

    const dispatched_event = (manager.dispatch_user_message_to_agent as any).mock.calls[0][0];
    expect(dispatched_event).toBeInstanceOf(ProcessUserMessageEvent);
    expect(dispatched_event.target_agent_name).toBe(agent_name);

    const user_message = dispatched_event.user_message;
    expect(user_message).toBeInstanceOf(AgentInputUserMessage);
    expect(user_message.content).toContain('You have new tasks');
    expect(user_message.metadata.sender_id).toBe(TASK_NOTIFIER_SENDER_ID);
  });

  it('logs error when team manager throws', async () => {
    const manager = makeTeamManager();
    manager.ensure_node_is_ready = vi.fn(async () => {
      throw new Error('Node failed to start');
    });
    const activator = new TaskActivator(manager as any);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await activator.activate_agent('AgentThatFails');

    expect(errorSpy).toHaveBeenCalled();
    expect(manager.dispatch_user_message_to_agent).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
