import { BaseBootstrapStep } from './base_bootstrap_step.js';
import { WorkspaceContextInitializationStep } from './workspace_context_initialization_step.js';
import { SystemPromptProcessingStep } from './system_prompt_processing_step.js';
import { McpServerPrewarmingStep } from './mcp_server_prewarming_step.js';

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
