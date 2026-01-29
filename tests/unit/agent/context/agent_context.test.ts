import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentContext } from '../../../../src/agent/context/agent_context.js';
import { AgentConfig } from '../../../../src/agent/context/agent_config.js';
import { AgentRuntimeState } from '../../../../src/agent/context/agent_runtime_state.js';
import { AgentStatus } from '../../../../src/agent/status/status_enum.js';
import { AgentInputEventQueueManager } from '../../../../src/agent/events/agent_input_event_queue_manager.js';
import { ToolInvocation } from '../../../../src/agent/tool_invocation.js';
import { BaseLLM } from '../../../../src/llm/base.js';
import { LLMModel } from '../../../../src/llm/models.js';
import { LLMProvider } from '../../../../src/llm/providers.js';
import { LLMConfig } from '../../../../src/llm/utils/llm_config.js';
import { CompleteResponse, ChunkResponse } from '../../../../src/llm/utils/response_types.js';
import { LLMUserMessage } from '../../../../src/llm/user_message.js';

class DummyLLM extends BaseLLM {
  protected async _sendUserMessageToLLM(_userMessage: LLMUserMessage): Promise<CompleteResponse> {
    return new CompleteResponse({ content: 'ok' });
  }

  protected async *_streamUserMessageToLLM(_userMessage: LLMUserMessage): AsyncGenerator<ChunkResponse, void, unknown> {
    yield new ChunkResponse({ content: 'ok', is_complete: true });
  }
}

const makeLLM = () => {
  const model = new LLMModel({
    name: 'dummy',
    value: 'dummy',
    canonical_name: 'dummy',
    provider: LLMProvider.OPENAI
  });
  return new DummyLLM(model, new LLMConfig());
};

describe('AgentContext', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requires valid agent_id, config, and state', () => {
    const llm = makeLLM();
    const config = new AgentConfig('name', 'role', 'desc', llm);
    const state = new AgentRuntimeState('agent-1');

    expect(() => new AgentContext('', config, state)).toThrow(/agent_id/);
    expect(() => new AgentContext('agent-1', {} as AgentConfig, state)).toThrow(/AgentConfig/);
    expect(() => new AgentContext('agent-1', config, {} as AgentRuntimeState)).toThrow(/AgentRuntimeState/);
  });

  it('exposes state-backed properties', () => {
    const llm = makeLLM();
    const config = new AgentConfig('name', 'role', 'desc', llm, null, null, false);
    const state = new AgentRuntimeState('agent-2');

    const context = new AgentContext('agent-2', config, state);

    expect(context.tool_instances).toEqual({});
    expect(context.auto_execute_tools).toBe(false);
    expect(context.llm_instance).toBeNull();

    context.llm_instance = llm;
    expect(context.llm_instance).toBe(llm);

    context.current_status = AgentStatus.IDLE;
    expect(context.current_status).toBe(AgentStatus.IDLE);
    expect(context.custom_data).toEqual({});
  });

  it('throws when input queues are not initialized', () => {
    const llm = makeLLM();
    const config = new AgentConfig('name', 'role', 'desc', llm);
    const state = new AgentRuntimeState('agent-3');

    const context = new AgentContext('agent-3', config, state);

    expect(() => context.input_event_queues).toThrow(/Input event queues/);

    state.input_event_queues = new AgentInputEventQueueManager();
    expect(context.input_event_queues).toBe(state.input_event_queues);
  });

  it('gets tools and warns when missing', () => {
    const llm = makeLLM();
    const config = new AgentConfig('name', 'role', 'desc', llm);
    const state = new AgentRuntimeState('agent-4');
    state.tool_instances = { TestTool: { name: 'TestTool' } as any };

    const context = new AgentContext('agent-4', config, state);

    expect(context.get_tool('TestTool')).toBe(state.tool_instances.TestTool);
    expect(context.get_tool('MissingTool')).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('MissingTool'));
  });

  it('stores and retrieves pending tool invocations', () => {
    const llm = makeLLM();
    const config = new AgentConfig('name', 'role', 'desc', llm);
    const state = new AgentRuntimeState('agent-5');
    const context = new AgentContext('agent-5', config, state);

    const invocation = new ToolInvocation('tool', { a: 1 }, 'inv-1');

    context.store_pending_tool_invocation(invocation);
    expect(context.pending_tool_approvals['inv-1']).toBe(invocation);

    const retrieved = context.retrieve_pending_tool_invocation('inv-1');
    expect(retrieved).toBe(invocation);
    expect(context.pending_tool_approvals['inv-1']).toBeUndefined();
  });

  it('sets processed system prompt', () => {
    const llm = makeLLM();
    const config = new AgentConfig('name', 'role', 'desc', llm);
    const state = new AgentRuntimeState('agent-6');
    const context = new AgentContext('agent-6', config, state);

    context.processed_system_prompt = 'processed';
    expect(context.processed_system_prompt).toBe('processed');
  });
});
