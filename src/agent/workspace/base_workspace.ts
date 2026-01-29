import { randomUUID } from 'crypto';
import { WorkspaceConfig } from './workspace_config.js';
import type { AgentContextLike } from '../context/agent_context_like.js';

export abstract class BaseAgentWorkspace {
  protected configValue: WorkspaceConfig;
  protected contextValue: AgentContextLike | null = null;
  readonly workspace_id: string;

  constructor(config?: WorkspaceConfig) {
    this.configValue = config ?? new WorkspaceConfig();
    this.workspace_id = randomUUID();
    console.debug(
      `${this.constructor.name} instance initialized with ID ${this.workspace_id}. Context pending injection.`
    );
  }

  set_context(context: AgentContextLike): void {
    if (this.contextValue) {
      console.warn(
        `Workspace for agent '${this.agent_id}' is having its context overwritten. This is unusual.`
      );
    }
    this.contextValue = context;
    console.info(`AgentContext for agent '${this.agent_id}' injected into workspace.`);
  }

  get agent_id(): string | null {
    return this.contextValue ? this.contextValue.agent_id : null;
  }

  get config(): WorkspaceConfig {
    return this.configValue;
  }

  abstract get_base_path(): string;

  get_name(): string {
    return this.workspace_id;
  }

  toString(): string {
    return `<${this.constructor.name} workspace_id='${this.workspace_id}' agent_id='${this.agent_id ?? 'N/A'}'>`;
  }
}
