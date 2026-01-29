import type { AgentContext } from '../context/agent_context.js';
import { BaseShutdownStep } from './base_shutdown_step.js';
import { LLMInstanceCleanupStep } from './llm_instance_cleanup_step.js';
import { ToolCleanupStep } from './tool_cleanup_step.js';
import { McpServerCleanupStep } from './mcp_server_cleanup_step.js';

export class AgentShutdownOrchestrator {
  shutdown_steps: BaseShutdownStep[];

  constructor(steps?: BaseShutdownStep[]) {
    if (!steps) {
      this.shutdown_steps = [
        new LLMInstanceCleanupStep(),
        new ToolCleanupStep(),
        new McpServerCleanupStep()
      ];
    } else {
      this.shutdown_steps = steps;
    }
  }

  async run(context: AgentContext): Promise<boolean> {
    const agentId = context.agent_id;

    for (let index = 0; index < this.shutdown_steps.length; index += 1) {
      const step = this.shutdown_steps[index];
      const success = await step.execute(context);
      if (!success) {
        console.error(`Agent '${agentId}': Shutdown step ${step.constructor.name} failed.`);
        return false;
      }
    }

    return true;
  }
}
