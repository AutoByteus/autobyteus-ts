import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryTaskPlan } from '../../../../src/task_management/in_memory_task_plan.js';
import { TaskDefinitionSchema } from '../../../../src/task_management/schemas/task_definition.js';
import { TaskStatus } from '../../../../src/task_management/base_task_plan.js';
import type { TasksCreatedEvent, TaskStatusUpdatedEvent } from '../../../../src/task_management/events.js';

vi.mock('../../../../src/agent_team/task_notification/activation_policy.js', () => {
  return { ActivationPolicy: vi.fn() };
});

vi.mock('../../../../src/agent_team/task_notification/task_activator.js', () => {
  return { TaskActivator: vi.fn() };
});

import { ActivationPolicy } from '../../../../src/agent_team/task_notification/activation_policy.js';
import { TaskActivator } from '../../../../src/agent_team/task_notification/task_activator.js';
import { SystemEventDrivenAgentTaskNotifier } from '../../../../src/agent_team/task_notification/system_event_driven_agent_task_notifier.js';

const makeTasks = () => {
  return [
    TaskDefinitionSchema.parse({
      task_name: 'task_a',
      assignee_name: 'AgentA',
      description: 'Task A.'
    }),
    TaskDefinitionSchema.parse({
      task_name: 'task_b',
      assignee_name: 'AgentB',
      description: 'Task B.',
      dependencies: ['task_a']
    })
  ];
};

describe('SystemEventDrivenAgentTaskNotifier', () => {
  let task_plan: InMemoryTaskPlan;
  let mock_policy: any;
  let mock_activator: any;

  beforeEach(() => {
    task_plan = new InMemoryTaskPlan('test_orchestrator_team');
    mock_policy = { reset: vi.fn(), determine_activations: vi.fn(() => []) };
    mock_activator = { activate_agent: vi.fn(async () => undefined) };

    (ActivationPolicy as any).mockImplementation(function () {
      return mock_policy;
    });
    (TaskActivator as any).mockImplementation(function () {
      return mock_activator;
    });
  });

  it('resets policy and activates on tasks created', async () => {
    const team_manager = { team_id: 'test_orchestrator_team' } as any;
    const notifier = new SystemEventDrivenAgentTaskNotifier(task_plan, team_manager);

    const created_tasks = task_plan.add_tasks(makeTasks());
    const task_a = created_tasks[0];

    mock_policy.determine_activations.mockReturnValue(['AgentA']);

    const event: TasksCreatedEvent = { team_id: task_plan.team_id, tasks: created_tasks } as any;
    await notifier._handle_tasks_changed(event);

    expect(mock_policy.reset).toHaveBeenCalledTimes(1);
    expect(mock_policy.determine_activations).toHaveBeenCalledTimes(1);
    expect(task_plan.task_statuses[task_a.task_id]).toBe(TaskStatus.QUEUED);
    expect(mock_activator.activate_agent).toHaveBeenCalledWith('AgentA');
  });

  it('does not reset policy on status update and activates handoff', async () => {
    const team_manager = { team_id: 'test_orchestrator_team' } as any;
    const notifier = new SystemEventDrivenAgentTaskNotifier(task_plan, team_manager);

    const created_tasks = task_plan.add_tasks(makeTasks());
    const task_b = created_tasks[1];

    mock_policy.determine_activations.mockReturnValue(['AgentB']);

    task_plan.update_task_status(created_tasks[0].task_id, TaskStatus.COMPLETED, 'AgentA');
    const event: TaskStatusUpdatedEvent = {
      team_id: task_plan.team_id,
      task_id: 'any_id',
      new_status: TaskStatus.COMPLETED,
      agent_name: 'AgentA'
    } as any;

    await notifier._handle_tasks_changed(event);

    expect(mock_policy.reset).not.toHaveBeenCalled();
    expect(mock_policy.determine_activations).toHaveBeenCalledTimes(1);
    expect(task_plan.task_statuses[task_b.task_id]).toBe(TaskStatus.QUEUED);
    expect(mock_activator.activate_agent).toHaveBeenCalledWith('AgentB');
  });

  it('does not activate if policy returns empty list', async () => {
    const team_manager = { team_id: 'test_orchestrator_team' } as any;
    const notifier = new SystemEventDrivenAgentTaskNotifier(task_plan, team_manager);

    mock_policy.determine_activations.mockReturnValue([]);

    const created_tasks = task_plan.add_tasks(makeTasks());
    task_plan.update_task_status(created_tasks[0].task_id, TaskStatus.COMPLETED, 'AgentA');

    const event: TaskStatusUpdatedEvent = {
      team_id: task_plan.team_id,
      task_id: 'any_id',
      new_status: TaskStatus.COMPLETED,
      agent_name: 'AgentA'
    } as any;

    await notifier._handle_tasks_changed(event);

    expect(mock_policy.determine_activations).toHaveBeenCalledTimes(1);
    expect(mock_activator.activate_agent).not.toHaveBeenCalled();
    expect(task_plan.task_statuses[created_tasks[1].task_id]).toBe(TaskStatus.NOT_STARTED);
  });
});
