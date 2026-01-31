import { BaseBootstrapStep } from './base-bootstrap-step.js';
import { WorkspaceContextInitializationStep } from './workspace-context-initialization-step.js';
import { SystemPromptProcessingStep } from './system-prompt-processing-step.js';
import { McpServerPrewarmingStep } from './mcp-server-prewarming-step.js';

export class AgentBootstrapper {
  bootstrapSteps: BaseBootstrapStep[];

  constructor(steps: BaseBootstrapStep[] | null = null) {
    if (!steps) {
      this.bootstrapSteps = [
        new WorkspaceContextInitializationStep(),
        new McpServerPrewarmingStep(),
        new SystemPromptProcessingStep()
      ];
      console.debug('AgentBootstrapper initialized with default steps.');
    } else {
      this.bootstrapSteps = steps;
      console.debug(`AgentBootstrapper initialized with ${steps.length} custom steps.`);
    }
  }
}
