import type { AgentTeamContext } from '../context/agent_team_context.js';

export abstract class BaseAgentTeamShutdownStep {
  abstract execute(context: AgentTeamContext): Promise<boolean>;
}
