import { BaseAgentTeamShutdownStep } from './base_agent_team_shutdown_step.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';

export class BridgeCleanupStep extends BaseAgentTeamShutdownStep {
  async execute(context: AgentTeamContext): Promise<boolean> {
    const team_id = context.team_id;
    console.info(`Team '${team_id}': Executing BridgeCleanupStep.`);

    const multiplexer: any = context.multiplexer;
    if (!multiplexer) {
      console.warn(`Team '${team_id}': No AgentEventMultiplexer found, cannot shut down event bridges.`);
      return true;
    }

    try {
      await multiplexer.shutdown();
      return true;
    } catch (error) {
      console.error(
        `Team '${team_id}': Error shutting down agent event bridges via multiplexer: ${error}`
      );
      return false;
    }
  }
}
