import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentBootstrapper } from '../../../../src/agent/bootstrap_steps/agent_bootstrapper.js';
import { BaseBootstrapStep } from '../../../../src/agent/bootstrap_steps/base_bootstrap_step.js';
import { WorkspaceContextInitializationStep } from '../../../../src/agent/bootstrap_steps/workspace_context_initialization_step.js';
import { McpServerPrewarmingStep } from '../../../../src/agent/bootstrap_steps/mcp_server_prewarming_step.js';
import { SystemPromptProcessingStep } from '../../../../src/agent/bootstrap_steps/system_prompt_processing_step.js';

class MockStep1 extends BaseBootstrapStep {
  async execute(): Promise<boolean> {
    return true;
  }
}

class MockStep2 extends BaseBootstrapStep {
  async execute(): Promise<boolean> {
    return true;
  }
}

describe('AgentBootstrapper', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    debugSpy.mockRestore();
  });

  it('initializes with default steps', () => {
    const bootstrapper = new AgentBootstrapper();
    expect(bootstrapper.bootstrap_steps).toHaveLength(3);
    expect(bootstrapper.bootstrap_steps[0]).toBeInstanceOf(WorkspaceContextInitializationStep);
    expect(bootstrapper.bootstrap_steps[1]).toBeInstanceOf(McpServerPrewarmingStep);
    expect(bootstrapper.bootstrap_steps[2]).toBeInstanceOf(SystemPromptProcessingStep);
    expect(
      debugSpy.mock.calls.some(([msg]: [unknown]) =>
        String(msg).includes('AgentBootstrapper initialized with default steps.')
      )
    ).toBe(true);
  });

  it('initializes with custom steps', () => {
    const customSteps = [new MockStep1(), new MockStep2()];
    const bootstrapper = new AgentBootstrapper(customSteps);
    expect(bootstrapper.bootstrap_steps).toBe(customSteps);
    expect(bootstrapper.bootstrap_steps).toHaveLength(2);
  });
});
