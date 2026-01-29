import { describe, it, expect } from 'vitest';
import { AddToDo } from '../../../../../src/task_management/tools/todo_tools/add_todo.js';
import { ToDoList } from '../../../../../src/task_management/todo_list.js';
import { ToDoDefinitionSchema } from '../../../../../src/task_management/schemas/todo_definition.js';

const buildContext = (agentId = 'agent_add_todo', withList = true) => ({
  agent_id: agentId,
  custom_data: {},
  status_manager: { notifier: { notify_agent_data_todo_list_updated: () => {} } },
  state: {
    todo_list: withList ? new ToDoList(agentId) : null
  }
});

describe('AddToDo tool', () => {
  it('exposes name and description', () => {
    expect(AddToDo.getName()).toBe('add_todo');
    expect(AddToDo.getDescription()).toContain('Adds a single new item');
  });

  it('adds a todo successfully', async () => {
    const tool = new AddToDo();
    const context = buildContext();

    const todoDef = ToDoDefinitionSchema.parse({ description: 'Draft introduction' });
    const result = await (tool as any)._execute(context, todoDef);

    expect(result).toBe("Successfully added new item to your to-do list: 'Draft introduction' (ID: todo_0001).");
    const todos = context.state.todo_list?.get_all_todos() ?? [];
    expect(todos).toHaveLength(1);
    expect(todos[0].description).toBe('Draft introduction');
    expect(todos[0].todo_id).toBe('todo_0001');
  });

  it('creates a list if missing', async () => {
    const tool = new AddToDo();
    const context = buildContext('agent_add_todo', false);

    const todoDef = ToDoDefinitionSchema.parse({ description: 'Set up environment' });
    const result = await (tool as any)._execute(context, todoDef);

    expect(result).toBe("Successfully added new item to your to-do list: 'Set up environment' (ID: todo_0001).");
    expect(context.state.todo_list).toBeInstanceOf(ToDoList);
    const todos = context.state.todo_list?.get_all_todos() ?? [];
    expect(todos).toHaveLength(1);
    expect(todos[0].description).toBe('Set up environment');
    expect(todos[0].todo_id).toBe('todo_0001');
  });

  it('returns an error for invalid payload', async () => {
    const tool = new AddToDo();
    const context = buildContext();
    const todosBefore = context.state.todo_list?.get_all_todos() ?? [];

    const result = await (tool as any)._execute(context, { invalid: 'data' });

    expect(result).toContain('Error: Invalid to-do item definition provided');
    expect(context.state.todo_list?.get_all_todos()).toEqual(todosBefore);
  });
});
