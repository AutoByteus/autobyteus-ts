import { ToDo, ToDoSchema, ToDoStatus } from './todo.js';
import type { ToDoDefinition } from './schemas/todo_definition.js';

export class ToDoList {
  agent_id: string;
  todos: ToDo[] = [];
  private todoMap: Map<string, ToDo> = new Map();
  private idCounter = 0;

  constructor(agent_id: string) {
    this.agent_id = agent_id;
  }

  private generate_next_id(): string {
    this.idCounter += 1;
    return `todo_${String(this.idCounter).padStart(4, '0')}`;
  }

  add_todos(todo_definitions: ToDoDefinition[]): ToDo[] {
    const newTodos: ToDo[] = [];

    for (const definition of todo_definitions) {
      const todo_id = this.generate_next_id();
      const todo = ToDoSchema.parse({
        todo_id,
        description: definition.description,
        status: ToDoStatus.PENDING
      });

      if (this.todoMap.has(todo.todo_id)) {
        continue;
      }

      this.todos.push(todo);
      this.todoMap.set(todo.todo_id, todo);
      newTodos.push(todo);
    }

    return newTodos;
  }

  add_todo(todo_definition: ToDoDefinition): ToDo {
    const todos = this.add_todos([todo_definition]);
    return todos[0];
  }

  get_todo_by_id(todo_id: string): ToDo | undefined {
    return this.todoMap.get(todo_id);
  }

  update_todo_status(todo_id: string, status: ToDoStatus): boolean {
    const todo = this.get_todo_by_id(todo_id);
    if (!todo) {
      return false;
    }

    todo.status = status;
    return true;
  }

  get_all_todos(): ToDo[] {
    return this.todos;
  }

  clear(): void {
    this.todos = [];
    this.todoMap.clear();
    this.idCounter = 0;
  }
}
