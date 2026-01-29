import { describe, it, expect } from 'vitest';
import { ToDoList } from '../../../src/task_management/todo_list.js';
import { ToDoStatus } from '../../../src/task_management/todo.js';

const todoDef = { description: 'Outline proposal' };

describe('ToDoList', () => {
  it('adds todos with sequential ids', () => {
    const list = new ToDoList('agent-1');
    const todo = list.add_todo(todoDef);

    expect(todo.todo_id).toBe('todo_0001');
    expect(list.get_all_todos().length).toBe(1);
  });

  it('updates todo status', () => {
    const list = new ToDoList('agent-1');
    const todo = list.add_todo(todoDef);

    const success = list.update_todo_status(todo.todo_id, ToDoStatus.DONE);
    expect(success).toBe(true);
    expect(todo.status).toBe(ToDoStatus.DONE);
  });

  it('returns false for missing todo', () => {
    const list = new ToDoList('agent-1');
    const success = list.update_todo_status('missing', ToDoStatus.DONE);
    expect(success).toBe(false);
  });
});
