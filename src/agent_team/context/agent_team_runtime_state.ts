import { AgentTeamStatus } from '../status/agent_team_status.js';
import type { AgentConfig } from '../../agent/context/agent_config.js';
import type { AgentTeamInputEventQueueManager } from '../events/agent_team_input_event_queue_manager.js';
import type { AgentTeamEventStore } from '../events/event_store.js';
import type { AgentTeamStatusManager } from '../status/agent_team_status_manager.js';
import type { AgentTeamStatusDeriver } from '../status/status_deriver.js';
import type { AgentEventMultiplexer } from '../streaming/agent_event_multiplexer.js';
import type { BaseTaskPlan } from '../../task_management/base_task_plan.js';
import type { SystemEventDrivenAgentTaskNotifier } from '../task_notification/system_event_driven_agent_task_notifier.js';
import type { TeamManager } from './team_manager.js';

export type AgentTeamRuntimeStateOptions = {
  team_id: string;
  current_status?: AgentTeamStatus;
};

type TeamManagerLike = TeamManager;

export class AgentTeamRuntimeState {
  team_id: string;
  current_status: AgentTeamStatus;

  prepared_agent_prompts: Record<string, string> = {};
  final_agent_configs: Record<string, AgentConfig> = {};

  team_manager: TeamManagerLike | null = null;
  task_notifier: SystemEventDrivenAgentTaskNotifier | null = null;

  input_event_queues: AgentTeamInputEventQueueManager | null = null;
  status_manager_ref: AgentTeamStatusManager | null = null;
  multiplexer_ref: AgentEventMultiplexer | null = null;
  event_store: AgentTeamEventStore | null = null;
  status_deriver: AgentTeamStatusDeriver | null = null;

  task_plan: BaseTaskPlan | null = null;

  constructor(options: AgentTeamRuntimeStateOptions) {
    this.team_id = options.team_id;
    this.current_status = options.current_status ?? AgentTeamStatus.UNINITIALIZED;

    this.validate();
    console.info(`AgentTeamRuntimeState initialized for team_id '${this.team_id}'.`);
  }

  private validate(): void {
    if (!this.team_id || typeof this.team_id !== 'string') {
      throw new Error("AgentTeamRuntimeState requires a non-empty string 'team_id'.");
    }
  }

  toString(): string {
    const manager = this.team_manager;
    const agentsCount = manager && typeof manager.get_all_agents === 'function'
      ? manager.get_all_agents().length
      : 0;
    const coordinatorSet = Boolean(manager && (manager as any).coordinator_agent);

    return (
      `<AgentTeamRuntimeState id='${this.team_id}', status='${this.current_status}', ` +
      `agents_count=${agentsCount}, coordinator_set=${coordinatorSet}, ` +
      `final_configs_count=${Object.keys(this.final_agent_configs).length}, ` +
      `team_manager_set=${this.team_manager !== null}>`
    );
  }
}
