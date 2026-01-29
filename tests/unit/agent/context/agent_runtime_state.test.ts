import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentRuntimeState } from '../../../../src/agent/context/agent_runtime_state.js';
import { AgentStatus } from '../../../../src/agent/status/status_enum.js';
import { BaseAgentWorkspace } from '../../../../src/agent/workspace/base_workspace.js';
import { ToolInvocation } from '../../../../src/agent/tool_invocation.js';

class TestWorkspace extends BaseAgentWorkspace {
  get_base_path(): string {
    return '/tmp';
  }
}

describe('AgentRuntimeState', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requires a non-empty agent_id', () => {
    expect(() => new AgentRuntimeState('')).toThrow(/agent_id/);
    expect(() => new AgentRuntimeState(null as unknown as string)).toThrow(/agent_id/);
  });

  it('initializes with defaults', () => {
    const state = new AgentRuntimeState('agent-1');

    expect(state.agent_id).toBe('agent-1');
    expect(state.current_status).toBe(AgentStatus.UNINITIALIZED);
    expect(state.conversation_history).toEqual([]);
    expect(state.pending_tool_approvals).toEqual({});
    expect(state.custom_data).toEqual({});
    expect(state.workspace).toBeNull();
    expect(state.active_multi_tool_call_turn).toBeNull();
    expect(state.todo_list).toBeNull();
  });

  it('accepts a workspace instance', () => {
    const workspace = new TestWorkspace();
    const state = new AgentRuntimeState('agent-2', workspace);

    expect(state.workspace).toBe(workspace);
  });

  it('rejects invalid workspace types', () => {
    expect(() => new AgentRuntimeState('agent-3', {} as BaseAgentWorkspace)).toThrow(/workspace/);
  });

  it('adds valid messages to history', () => {
    const state = new AgentRuntimeState('agent-4');

    state.add_message_to_history({ role: 'user', content: 'hi' });

    expect(state.conversation_history).toHaveLength(1);
    expect(state.conversation_history[0]).toEqual({ role: 'user', content: 'hi' });
  });

  it('ignores malformed messages', () => {
    const state = new AgentRuntimeState('agent-5');

    state.add_message_to_history({ content: 'missing role' } as Record<string, unknown>);

    expect(state.conversation_history).toHaveLength(0);
  });

  it('stores and retrieves pending tool invocations', () => {
    const state = new AgentRuntimeState('agent-6');
    const invocation = new ToolInvocation('tool', { foo: 'bar' }, 'inv-1');

    state.store_pending_tool_invocation(invocation);
    expect(state.pending_tool_approvals['inv-1']).toBe(invocation);

    const retrieved = state.retrieve_pending_tool_invocation('inv-1');
    expect(retrieved).toBe(invocation);
    expect(state.pending_tool_approvals['inv-1']).toBeUndefined();
  });

  it('handles missing pending tool invocations', () => {
    const state = new AgentRuntimeState('agent-7');

    expect(state.retrieve_pending_tool_invocation('missing')).toBeUndefined();
  });

  it('does not store invalid tool invocations', () => {
    const state = new AgentRuntimeState('agent-8');

    state.store_pending_tool_invocation({} as ToolInvocation);

    expect(Object.keys(state.pending_tool_approvals)).toHaveLength(0);
  });

  it('renders a readable string representation', () => {
    const state = new AgentRuntimeState('agent-9');

    expect(state.toString()).toContain("agent_id='agent-9'");
    expect(state.toString()).toContain("current_status='uninitialized'");
  });
});
