import { BaseBootstrapStep } from './base_bootstrap_step.js';
import type { AgentContext } from '../context/agent_context.js';

export class WorkspaceContextInitializationStep extends BaseBootstrapStep {
  constructor() {
    super();
    console.debug('WorkspaceContextInitializationStep initialized.');
  }

  async execute(context: AgentContext): Promise<boolean> {
    const agentId = context.agent_id;
    console.info(`Agent '${agentId}': Executing WorkspaceContextInitializationStep.`);

    const workspace = context.workspace;
    if (!workspace) {
      console.debug(`Agent '${agentId}': No workspace configured. Skipping context injection.`);
      return true;
    }

    try {
      const maybeSetContext = (workspace as any).set_context ?? (workspace as any).setContext;
      if (typeof maybeSetContext === 'function') {
        maybeSetContext.call(workspace, context);
        console.info(
          `Agent '${agentId}': AgentContext successfully injected into workspace instance of type '${workspace.constructor.name}'.`
        );
      } else {
        console.warn(
          `Agent '${agentId}': Configured workspace of type '${workspace.constructor.name}' does not have a 'set_context' method. ` +
            "Workspace will not have access to the agent's context."
        );
      }
      return true;
    } catch (error) {
      console.error(
        `Agent '${agentId}': Critical failure during WorkspaceContextInitializationStep: ${error}`
      );
      return false;
    }
  }
}
