import type { AgentTeamRuntime } from './runtime/agent_team_runtime.js';
import type { AgentTeamExternalEventNotifier } from './streaming/agent_team_event_notifier.js';
import { ProcessUserMessageEvent, ToolApprovalTeamEvent } from './events/agent_team_events.js';
import type { AgentInputUserMessage } from '../agent/message/agent_input_user_message.js';
import { AgentTeamStatus } from './status/agent_team_status.js';

export class AgentTeam {
  private _runtime: AgentTeamRuntime;
  team_id: string;

  constructor(runtime: AgentTeamRuntime) {
    if (!runtime) {
      throw new TypeError('AgentTeam requires a valid AgentTeamRuntime instance.');
    }

    this._runtime = runtime;
    this.team_id = this._runtime.context.team_id;
    console.info(`AgentTeam facade created for team ID '${this.team_id}'.`);
  }

  get name(): string {
    return this._runtime.context.config.name;
  }

  get role(): string | null | undefined {
    return this._runtime.context.config.role ?? null;
  }

  async post_message(message: AgentInputUserMessage, target_agent_name?: string | null): Promise<void> {
    const final_target = target_agent_name || this._runtime.context.config.coordinator_node.name;
    console.info(`Agent Team '${this.team_id}': post_message called. Target: '${final_target}'.`);

    if (!this._runtime.is_running) {
      this.start();
    }

    const event = new ProcessUserMessageEvent(message, final_target);
    await this._runtime.submit_event(event);
  }

  async post_tool_execution_approval(
    agent_name: string,
    tool_invocation_id: string,
    is_approved: boolean,
    reason?: string | null
  ): Promise<void> {
    console.info(
      `Agent Team '${this.team_id}': post_tool_execution_approval called for agent '${agent_name}'. Approved: ${is_approved}.`
    );

    if (!this._runtime.is_running) {
      console.warn(`Agent Team '${this.team_id}' is not running. Cannot post approval.`);
      return;
    }

    const event = new ToolApprovalTeamEvent(agent_name, tool_invocation_id, is_approved, reason ?? undefined);
    await this._runtime.submit_event(event);
  }

  start(): void {
    this._runtime.start();
  }

  async stop(timeout: number = 10.0): Promise<void> {
    await this._runtime.stop(timeout);
  }

  get is_running(): boolean {
    return this._runtime.is_running;
  }

  get_current_status(): AgentTeamStatus {
    return this._runtime.context.state.current_status;
  }

  get notifier(): AgentTeamExternalEventNotifier {
    return this._runtime.notifier;
  }
}
