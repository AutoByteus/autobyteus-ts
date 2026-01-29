import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgentWorkspace } from '../../../../src/agent/workspace/base_workspace.js';
import { WorkspaceConfig } from '../../../../src/agent/workspace/workspace_config.js';

class TestWorkspace extends BaseAgentWorkspace {
  get_base_path(): string {
    return '/tmp';
  }
}

describe('BaseAgentWorkspace', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default config and workspace id', () => {
    const workspace = new TestWorkspace();

    expect(workspace.config).toBeInstanceOf(WorkspaceConfig);
    expect(workspace.workspace_id).toBeTruthy();
    expect(workspace.agent_id).toBeNull();
  });

  it('uses provided config', () => {
    const config = new WorkspaceConfig({ path: '/data' });
    const workspace = new TestWorkspace(config);

    expect(workspace.config).toBe(config);
  });

  it('sets context and exposes agent_id', () => {
    const workspace = new TestWorkspace();
    const context = { agent_id: 'agent-123' };

    workspace.set_context(context);

    expect(workspace.agent_id).toBe('agent-123');
  });

  it('warns when overwriting context', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const workspace = new TestWorkspace();

    workspace.set_context({ agent_id: 'agent-1' });
    workspace.set_context({ agent_id: 'agent-2' });

    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('returns workspace name as workspace id by default', () => {
    const workspace = new TestWorkspace();

    expect(workspace.get_name()).toBe(workspace.workspace_id);
  });

  it('renders a readable string representation', () => {
    const workspace = new TestWorkspace();
    workspace.set_context({ agent_id: 'agent-42' });

    expect(workspace.toString()).toBe(
      `<TestWorkspace workspace_id='${workspace.workspace_id}' agent_id='agent-42'>`
    );
  });
});
