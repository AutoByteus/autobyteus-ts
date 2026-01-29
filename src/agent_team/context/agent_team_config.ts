import { TeamNodeConfig } from './team_node_config.js';
import {
  TaskNotificationMode,
  resolve_task_notification_mode
} from '../task_notification/task_notification_mode.js';

export class AgentTeamConfig {
  readonly name: string;
  readonly description: string;
  readonly nodes: TeamNodeConfig[];
  readonly coordinator_node: TeamNodeConfig;
  readonly role?: string | null;
  readonly task_notification_mode: TaskNotificationMode;

  constructor(options: {
    name: string;
    description: string;
    nodes: TeamNodeConfig[];
    coordinator_node: TeamNodeConfig;
    role?: string | null;
  }) {
    this.name = options.name;
    this.description = options.description;
    this.nodes = options.nodes;
    this.coordinator_node = options.coordinator_node;
    this.role = options.role ?? null;
    this.task_notification_mode = resolve_task_notification_mode();

    this.validate();
    Object.freeze(this);
  }

  private validate(): void {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error("The 'name' in AgentTeamConfig must be a non-empty string.");
    }

    if (!this.nodes || this.nodes.length === 0) {
      throw new Error("The 'nodes' collection in AgentTeamConfig cannot be empty.");
    }

    if (!this.nodes.includes(this.coordinator_node)) {
      throw new Error("The 'coordinator_node' must be one of the nodes in the 'nodes' collection.");
    }

    if (!Object.values(TaskNotificationMode).includes(this.task_notification_mode)) {
      throw new TypeError("The 'task_notification_mode' must be an instance of TaskNotificationMode enum.");
    }
  }
}
