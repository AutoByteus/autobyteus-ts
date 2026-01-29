import { describe, it, expect } from 'vitest';
import { UpdateTaskStatus } from '../../../../../src/task_management/tools/task_tools/update_task_status.js';
import { InMemoryTaskPlan } from '../../../../../src/task_management/in_memory_task_plan.js';
import { TaskStatus } from '../../../../../src/task_management/base_task_plan.js';
import type { TaskDefinition } from '../../../../../src/task_management/schemas/task_definition.js';

const buildTaskPlan = () => {
  const plan = new InMemoryTaskPlan('test_team_tool');
  const taskDefs: TaskDefinition[] = [
    { task_name: 'task_a', assignee_name: 'Agent1', description: 'First task.', dependencies: [] },
    { task_name: 'task_b', assignee_name: 'Agent2', description: 'Second task.', dependencies: [] }
  ];
  plan.add_tasks(taskDefs);
  return plan;
};

const buildAgentContext = (taskPlan: InMemoryTaskPlan) => ({
  agentId: 'test_agent',
  config: { name: 'TestAgent' },
  custom_data: {
    team_context: {
      state: { task_plan: taskPlan }
    }
  }
});

describe('UpdateTaskStatus tool', () => {
  it('updates status without deliverables', async () => {
    const taskPlan = buildTaskPlan();
    const context = buildAgentContext(taskPlan);
    const tool = new UpdateTaskStatus();

    const taskIdToCheck = taskPlan.tasks.find((task) => task.task_name === 'task_a')?.task_id;
    expect(taskIdToCheck).toBe('task_0001');
    expect(taskPlan.task_statuses[taskIdToCheck!]).toBe(TaskStatus.NOT_STARTED);

    const result = await (tool as any)._execute(context, {
      task_name: 'task_a',
      status: 'in_progress'
    });

    expect(result).toBe("Successfully updated status of task 'task_a' to 'in_progress'.");
    expect(taskPlan.task_statuses[taskIdToCheck!]).toBe(TaskStatus.IN_PROGRESS);
  });

  it('updates status and adds deliverables', async () => {
    const taskPlan = buildTaskPlan();
    const context = buildAgentContext(taskPlan);
    const tool = new UpdateTaskStatus();

    const result = await (tool as any)._execute(context, {
      task_name: 'task_b',
      status: 'completed',
      deliverables: [{ file_path: 'output/report.md', summary: 'Initial report draft.' }]
    });

    expect(result).toContain("Successfully updated status of task 'task_b' to 'completed'");
    expect(result).toContain('and submitted 1 deliverable(s)');

    const updatedTask = taskPlan.tasks.find((task) => task.task_name === 'task_b');
    expect(updatedTask?.file_deliverables.length).toBe(1);
    expect(updatedTask?.file_deliverables[0].file_path).toBe('output/report.md');
    expect(updatedTask?.file_deliverables[0].author_agent_name).toBe('TestAgent');
  });

  it('returns an error for invalid deliverables and does not update status', async () => {
    const taskPlan = buildTaskPlan();
    const context = buildAgentContext(taskPlan);
    const tool = new UpdateTaskStatus();

    const taskIdToCheck = taskPlan.tasks.find((task) => task.task_name === 'task_a')?.task_id;
    expect(taskPlan.task_statuses[taskIdToCheck!]).toBe(TaskStatus.NOT_STARTED);

    const result = await (tool as any)._execute(context, {
      task_name: 'task_a',
      status: 'completed',
      deliverables: [{ file_path: 'output/bad.txt' }]
    });

    expect(result).toContain('Error: Failed to process deliverables due to invalid data');
    expect(taskPlan.task_statuses[taskIdToCheck!]).toBe(TaskStatus.NOT_STARTED);
  });
});
