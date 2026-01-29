import type { BaseAgentTeamEvent } from '../events/agent_team_events.js';

type AgentTeamContext = unknown;

export abstract class BaseAgentTeamEventHandler {
  abstract handle(event: BaseAgentTeamEvent, context: AgentTeamContext): Promise<void>;
}
