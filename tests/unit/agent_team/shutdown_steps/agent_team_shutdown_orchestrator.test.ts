import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../src/agent_team/shutdown_steps/bridge_cleanup_step.js', () => ({
  BridgeCleanupStep: vi.fn().mockImplementation(function () {})
}));
vi.mock('../../../../src/agent_team/shutdown_steps/sub_team_shutdown_step.js', () => ({
  SubTeamShutdownStep: vi.fn().mockImplementation(function () {})
}));
vi.mock('../../../../src/agent_team/shutdown_steps/agent_team_shutdown_step.js', () => ({
  AgentTeamShutdownStep: vi.fn().mockImplementation(function () {})
}));

import { AgentTeamShutdownOrchestrator } from '../../../../src/agent_team/shutdown_steps/agent_team_shutdown_orchestrator.js';
import { BridgeCleanupStep } from '../../../../src/agent_team/shutdown_steps/bridge_cleanup_step.js';
import { SubTeamShutdownStep } from '../../../../src/agent_team/shutdown_steps/sub_team_shutdown_step.js';
import { AgentTeamShutdownStep } from '../../../../src/agent_team/shutdown_steps/agent_team_shutdown_step.js';
import type { AgentTeamContext } from '../../../../src/agent_team/context/agent_team_context.js';

const makeContext = (): AgentTeamContext => ({ teamId: 'team-1' } as AgentTeamContext);

describe('AgentTeamShutdownOrchestrator', () => {
  it('initializes with default steps', () => {
    const orchestrator = new AgentTeamShutdownOrchestrator();

    expect(BridgeCleanupStep).toHaveBeenCalledTimes(1);
    expect(SubTeamShutdownStep).toHaveBeenCalledTimes(1);
    expect(AgentTeamShutdownStep).toHaveBeenCalledTimes(1);
    expect(orchestrator.shutdownSteps.length).toBe(3);
  });

  it('initializes with custom steps', () => {
    const step1 = { execute: vi.fn(async () => true) } as any;
    const step2 = { execute: vi.fn(async () => true) } as any;

    const orchestrator = new AgentTeamShutdownOrchestrator([step1, step2]);

    expect(orchestrator.shutdownSteps).toEqual([step1, step2]);
  });

  it('runs all steps successfully', async () => {
    const step1 = { execute: vi.fn(async () => true) } as any;
    const step2 = { execute: vi.fn(async () => true) } as any;
    const orchestrator = new AgentTeamShutdownOrchestrator([step1, step2]);
    const context = makeContext();

    const success = await orchestrator.run(context);

    expect(success).toBe(true);
    expect(step1.execute).toHaveBeenCalledWith(context);
    expect(step2.execute).toHaveBeenCalledWith(context);
  });

  it('continues on failure and reports false', async () => {
    const step1 = { execute: vi.fn(async () => false) } as any;
    const step2 = { execute: vi.fn(async () => true) } as any;
    const orchestrator = new AgentTeamShutdownOrchestrator([step1, step2]);
    const context = makeContext();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const success = await orchestrator.run(context);

    expect(success).toBe(false);
    expect(step1.execute).toHaveBeenCalledWith(context);
    expect(step2.execute).toHaveBeenCalledWith(context);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
