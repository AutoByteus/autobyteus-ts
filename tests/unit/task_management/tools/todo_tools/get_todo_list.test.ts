import { describe, it, expect } from 'vitest';
import { GetToDoList } from '../../../../../src/task_management/tools/todo_tools/get_todo_list.js';
import { ToDoList } from '../../../../../src/task_management/todo_list.js';
import { ToDoDefinitionSchema } from '../../../../../src/task_management/schemas/todo_definition.js';

const buildContext = (agentId = 'agent_get_todos', withItems = true) => {
  const todoList = new ToDoList(agentId);
  if (withItems) {
    todoList.add_todos([
      ToDoDefinitionSchema.parse({ description: 'Outline proposal' }),
      ToDoDefinitionSchema.parse({ description: 'Share proposal with mentor' })
    ]);
  }

  return {
    agent_id: agentId,
    state: {
      todo_list: withItems ? todoList : null
    }
  };
};

describe('GetToDoList tool', () => {
  it('exposes name and description', () => {
    expect(GetToDoList.getName()).toBe('get_todo_list');
    expect(GetToDoList.getDescription()).toContain('Retrieves your current personal to-do list');
  });

  it('returns a JSON list when items exist', async () => {
    const tool = new GetToDoList();
    const context = buildContext();

    const result = await (tool as any)._execute(context);

    const items = JSON.parse(result);
    expect(items).toHaveLength(2);
    expect(items[0].description).toBe('Outline proposal');
    expect(items[0].todo_id).toBe('todo_0001');
    expect(items[1].description).toBe('Share proposal with mentor');
    expect(items[1].todo_id).toBe('todo_0002');
  });

  it('returns empty message when list is missing', async () => {
    const tool = new GetToDoList();
    const context = buildContext('agent_get_todos', false);

    const result = await (tool as any)._execute(context);

    expect(result).toBe('Your to-do list is empty.');
  });

  it('returns empty message when list has no items', async () => {
    const tool = new GetToDoList();
    const context = buildContext('agent_get_todos', false);
    context.state.todo_list = new ToDoList('test');

    const result = await (tool as any)._execute(context);

    expect(result).toBe('Your to-do list is empty.');
  });
});
