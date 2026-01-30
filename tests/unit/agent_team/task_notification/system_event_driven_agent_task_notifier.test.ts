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
  let taskPlan: InMemoryTaskPlan;
  let mockPolicy: any;
  let mockActivator: any;

  beforeEach(() => {
    taskPlan = new InMemoryTaskPlan('test_orchestrator_team');
    mockPolicy = { reset: vi.fn(), determineActivations: vi.fn(() => []) };
    mockActivator = { activateAgent: vi.fn(async () => undefined) };

    (ActivationPolicy as any).mockImplementation(function () {
      return mockPolicy;
    });
    (TaskActivator as any).mockImplementation(function () {
      return mockActivator;
    });
  });

  it('resets policy and activates on tasks created', async () => {
    const teamManager = { teamId: 'test_orchestrator_team' } as any;
    const notifier = new SystemEventDrivenAgentTaskNotifier(taskPlan, teamManager);

    const createdTasks = taskPlan.addTasks(makeTasks());
    const taskA = createdTasks[0];

    mockPolicy.determineActivations.mockReturnValue(['AgentA']);

    const event: TasksCreatedEvent = { team_id: taskPlan.teamId, tasks: createdTasks } as any;
    await notifier.handleTasksChanged(event);

    expect(mockPolicy.reset).toHaveBeenCalledTimes(1);
    expect(mockPolicy.determineActivations).toHaveBeenCalledTimes(1);
    expect(taskPlan.taskStatuses[taskA.task_id]).toBe(TaskStatus.QUEUED);
    expect(mockActivator.activateAgent).toHaveBeenCalledWith('AgentA');
  });

  it('does not reset policy on status update and activates handoff', async () => {
    const teamManager = { teamId: 'test_orchestrator_team' } as any;
    const notifier = new SystemEventDrivenAgentTaskNotifier(taskPlan, teamManager);

    const createdTasks = taskPlan.addTasks(makeTasks());
    const taskB = createdTasks[1];

    mockPolicy.determineActivations.mockReturnValue(['AgentB']);

    taskPlan.updateTaskStatus(createdTasks[0].task_id, TaskStatus.COMPLETED, 'AgentA');
    const event: TaskStatusUpdatedEvent = {
      team_id: taskPlan.teamId,
      task_id: 'any_id',
      new_status: TaskStatus.COMPLETED,
      agent_name: 'AgentA'
    } as any;

    await notifier.handleTasksChanged(event);

    expect(mockPolicy.reset).not.toHaveBeenCalled();
    expect(mockPolicy.determineActivations).toHaveBeenCalledTimes(1);
    expect(taskPlan.taskStatuses[taskB.task_id]).toBe(TaskStatus.QUEUED);
    expect(mockActivator.activateAgent).toHaveBeenCalledWith('AgentB');
  });

  it('does not activate if policy returns empty list', async () => {
    const teamManager = { teamId: 'test_orchestrator_team' } as any;
    const notifier = new SystemEventDrivenAgentTaskNotifier(taskPlan, teamManager);

    mockPolicy.determineActivations.mockReturnValue([]);

    const createdTasks = taskPlan.addTasks(makeTasks());
    taskPlan.updateTaskStatus(createdTasks[0].task_id, TaskStatus.COMPLETED, 'AgentA');

    const event: TaskStatusUpdatedEvent = {
      team_id: taskPlan.teamId,
      task_id: 'any_id',
      new_status: TaskStatus.COMPLETED,
      agent_name: 'AgentA'
    } as any;

    await notifier.handleTasksChanged(event);

    expect(mockPolicy.determineActivations).toHaveBeenCalledTimes(1);
    expect(mockActivator.activateAgent).not.toHaveBeenCalled();
    expect(taskPlan.taskStatuses[createdTasks[1].task_id]).toBe(TaskStatus.NOT_STARTED);
  });
});
