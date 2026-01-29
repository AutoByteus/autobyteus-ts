import { describe, it, expect, beforeEach } from 'vitest';
import { ActivationPolicy } from '../../../../src/agent_team/task_notification/activation_policy.js';

const createMockTask = (assignee: string) => ({ assignee_name: assignee }) as any;

describe('ActivationPolicy', () => {
  let policy: ActivationPolicy;

  beforeEach(() => {
    policy = new ActivationPolicy('test_policy_team');
  });

  it('initializes with empty activated agents set', () => {
    expect(policy._activated_agents).toEqual(new Set());
  });

  it('activates new agents on first call', () => {
    const runnable_tasks = [createMockTask('AgentA'), createMockTask('AgentB'), createMockTask('AgentA')];

    const activations = policy.determine_activations(runnable_tasks);

    expect(activations.sort()).toEqual(['AgentA', 'AgentB']);
    expect(policy._activated_agents).toEqual(new Set(['AgentA', 'AgentB']));
  });

  it('returns empty list if no new agents', () => {
    policy._activated_agents = new Set(['AgentA', 'AgentB']);
    const runnable_tasks = [createMockTask('AgentA'), createMockTask('AgentB')];

    const activations = policy.determine_activations(runnable_tasks);

    expect(activations).toEqual([]);
    expect(policy._activated_agents).toEqual(new Set(['AgentA', 'AgentB']));
  });

  it('activates new agent on handoff', () => {
    policy._activated_agents = new Set(['AgentA']);
    const runnable_tasks = [createMockTask('AgentB')];

    const activations = policy.determine_activations(runnable_tasks);

    expect(activations).toEqual(['AgentB']);
    expect(policy._activated_agents).toEqual(new Set(['AgentA', 'AgentB']));
  });

  it('activates only new agents in mixed batch', () => {
    policy._activated_agents = new Set(['AgentA']);
    const runnable_tasks = [createMockTask('AgentA'), createMockTask('AgentB')];

    const activations = policy.determine_activations(runnable_tasks);

    expect(activations).toEqual(['AgentB']);
    expect(policy._activated_agents).toEqual(new Set(['AgentA', 'AgentB']));
  });

  it('reset clears activation state', () => {
    policy._activated_agents = new Set(['AgentA', 'AgentB']);

    policy.reset();

    expect(policy._activated_agents).toEqual(new Set());
  });

  it('activates after reset', () => {
    policy._activated_agents = new Set(['AgentA']);
    policy.reset();

    const activations = policy.determine_activations([createMockTask('AgentA')]);

    expect(activations).toEqual(['AgentA']);
    expect(policy._activated_agents).toEqual(new Set(['AgentA']));
  });

  it('returns empty list for empty input', () => {
    const activations = policy.determine_activations([]);

    expect(activations).toEqual([]);
    expect(policy._activated_agents).toEqual(new Set());
  });
});
