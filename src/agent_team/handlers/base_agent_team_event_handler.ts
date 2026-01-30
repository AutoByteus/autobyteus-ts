import type { BaseAgentTeamEvent } from '../events/agent_team_events.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';

export abstract class BaseAgentTeamEventHandler {
  abstract handle(event: BaseAgentTeamEvent, context: AgentTeamContext): Promise<void>;
}
