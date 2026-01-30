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
  teamId: string;
  currentStatus?: AgentTeamStatus;
};

type TeamManagerLike = TeamManager;

export class AgentTeamRuntimeState {
  teamId: string;
  currentStatus: AgentTeamStatus;

  preparedAgentPrompts: Record<string, string> = {};
  finalAgentConfigs: Record<string, AgentConfig> = {};

  teamManager: TeamManagerLike | null = null;
  taskNotifier: SystemEventDrivenAgentTaskNotifier | null = null;

  inputEventQueues: AgentTeamInputEventQueueManager | null = null;
  statusManagerRef: AgentTeamStatusManager | null = null;
  multiplexerRef: AgentEventMultiplexer | null = null;
  eventStore: AgentTeamEventStore | null = null;
  statusDeriver: AgentTeamStatusDeriver | null = null;

  taskPlan: BaseTaskPlan | null = null;

  constructor(options: AgentTeamRuntimeStateOptions) {
    this.teamId = options.teamId;
    this.currentStatus = options.currentStatus ?? AgentTeamStatus.UNINITIALIZED;

    this.validate();
    console.info(`AgentTeamRuntimeState initialized for team '${this.teamId}'.`);
  }

  private validate(): void {
    if (!this.teamId || typeof this.teamId !== 'string') {
      throw new Error("AgentTeamRuntimeState requires a non-empty string 'teamId'.");
    }
  }

  toString(): string {
    const manager = this.teamManager;
    const agentsCount = manager && typeof manager.getAllAgents === 'function'
      ? manager.getAllAgents().length
      : 0;
    const coordinatorSet = Boolean(manager && manager.coordinatorAgent);

    return (
      `<AgentTeamRuntimeState id='${this.teamId}', status='${this.currentStatus}', ` +
      `agents_count=${agentsCount}, coordinator_set=${coordinatorSet}, ` +
      `final_configs_count=${Object.keys(this.finalAgentConfigs).length}, ` +
      `team_manager_set=${this.teamManager !== null}>`
    );
  }
}
