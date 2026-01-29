import { describe, it, expect, vi } from 'vitest';
import { AssignTaskTo } from '../../../../../src/task_management/tools/task_tools/assign_task_to.js';
import { InMemoryTaskPlan } from '../../../../../src/task_management/in_memory_task_plan.js';
import { TaskDefinitionSchema } from '../../../../../src/task_management/schemas/task_definition.js';
import { InterAgentMessageRequestEvent } from '../../../../../src/agent_team/events/agent_team_events.js';

const makeAgentContext = () => ({
  agent_id: 'sender_agent_id',
  config: { name: 'SenderAgent' },
  custom_data: {} as Record<string, any>
});

const makeTeamContext = () => {
  const taskPlan = new InMemoryTaskPlan('test_team');
  const setupTaskDef = TaskDefinitionSchema.parse({
    task_name: 'setup',
    assignee_name: 'a',
    description: 'd',
    dependencies: []
  });
  taskPlan.add_task(setupTaskDef);

  return {
    state: { task_plan: taskPlan },
    team_manager: {
      dispatch_inter_agent_message_request: vi.fn().mockResolvedValue(undefined)
    }
  };
};

describe('AssignTaskTo tool', () => {
  it('exposes name and description', () => {
    expect(AssignTaskTo.getName()).toBe('assign_task_to');
    expect(AssignTaskTo.getDescription()).toContain('assigns a single new task to a specific team member');
  });

  it('publishes the task and sends a notification', async () => {
    const tool = new AssignTaskTo();
    const context = makeAgentContext();
    const teamContext = makeTeamContext();
    context.custom_data.team_context = teamContext;

    const taskDef = TaskDefinitionSchema.parse({
      task_name: 'new_delegated_task',
      assignee_name: 'RecipientAgent',
      description: 'Please do this work.',
      dependencies: ['setup']
    });

    const result = await (tool as any)._execute(context, taskDef);

    expect(result).toBe("Successfully assigned task 'new_delegated_task' to agent 'RecipientAgent' and sent a notification.");

    const taskPlan = teamContext.state.task_plan as InMemoryTaskPlan;
    expect(taskPlan.tasks.length).toBe(2);

    const newTask = taskPlan.tasks.find((task) => task.task_name === 'new_delegated_task');
    expect(newTask).toBeTruthy();
    expect(newTask?.assignee_name).toBe('RecipientAgent');
    expect(newTask?.task_id).toBe('task_0002');

    const teamManager = teamContext.team_manager;
    expect(teamManager.dispatch_inter_agent_message_request).toHaveBeenCalledOnce();
    const [sentEvent] = teamManager.dispatch_inter_agent_message_request.mock.calls[0];

    expect(sentEvent).toBeInstanceOf(InterAgentMessageRequestEvent);
    expect(sentEvent.sender_agent_id).toBe('sender_agent_id');
    expect(sentEvent.recipient_name).toBe('RecipientAgent');
    expect(sentEvent.message_type).toBe('task_assignment');
    expect(sentEvent.content).toContain("**Task Name**: 'new_delegated_task'");
    expect(sentEvent.content).toContain('**Description**: Please do this work.');
    expect(sentEvent.content).toContain('**Dependencies**: setup');
  });

  it('returns an error when team context is missing', async () => {
    const tool = new AssignTaskTo();
    const context = makeAgentContext();

    const result = await (tool as any)._execute(context, {
      task_name: 't',
      assignee_name: 'a',
      description: 'd'
    });

    expect(result).toContain('Error: Team context is not available');
  });

  it('returns an error when task plan is missing', async () => {
    const tool = new AssignTaskTo();
    const context = makeAgentContext();
    context.custom_data.team_context = { state: { task_plan: null } };

    const result = await (tool as any)._execute(context, {
      task_name: 't',
      assignee_name: 'a',
      description: 'd'
    });

    expect(result).toContain('Error: Task plan has not been initialized');
  });

  it('returns a warning when team manager is missing', async () => {
    const tool = new AssignTaskTo();
    const context = makeAgentContext();
    const teamContext = makeTeamContext();
    teamContext.team_manager = null as any;
    context.custom_data.team_context = teamContext;

    const taskDef = TaskDefinitionSchema.parse({
      task_name: 'delegated_task_no_notify',
      assignee_name: 'RecipientAgent',
      description: 'Work to be done.',
      dependencies: []
    });

    const result = await (tool as any)._execute(context, taskDef);

    expect(result).toContain("Successfully published task 'delegated_task_no_notify', but could not send a direct notification");
    const taskPlan = teamContext.state.task_plan as InMemoryTaskPlan;
    expect(taskPlan.tasks.length).toBe(2);
  });

  it('returns an error for invalid task definitions', async () => {
    const tool = new AssignTaskTo();
    const context = makeAgentContext();
    const teamContext = makeTeamContext();
    context.custom_data.team_context = teamContext;

    const result = await (tool as any)._execute(context, { task_name: 'invalid_task' });

    expect(result).toContain('Error: Invalid task definition provided');
    const taskPlan = teamContext.state.task_plan as InMemoryTaskPlan;
    expect(taskPlan.tasks.length).toBe(1);
  });
});
