import { describe, it, expect, vi } from 'vitest';
import { Agent } from '../../../src/agent/agent.js';
import { AgentStatus } from '../../../src/agent/status/status_enum.js';
import { AgentInputUserMessage } from '../../../src/agent/message/agent_input_user_message.js';
import { InterAgentMessage } from '../../../src/agent/message/inter_agent_message.js';
import { InterAgentMessageType } from '../../../src/agent/message/inter_agent_message_type.js';
import { UserMessageReceivedEvent, InterAgentMessageReceivedEvent, ToolExecutionApprovalEvent } from '../../../src/agent/events/agent_events.js';
import { AgentRuntime } from '../../../src/agent/runtime/agent_runtime.js';
import { AgentRuntimeState } from '../../../src/agent/context/agent_runtime_state.js';
import { AgentConfig } from '../../../src/agent/context/agent_config.js';
import { AgentContext } from '../../../src/agent/context/agent_context.js';
import { BaseLLM } from '../../../src/llm/base.js';
import { LLMModel } from '../../../src/llm/models.js';
import { LLMProvider } from '../../../src/llm/providers.js';
import { LLMConfig } from '../../../src/llm/utils/llm_config.js';
import { CompleteResponse } from '../../../src/llm/utils/response_types.js';
import type { LLMUserMessage } from '../../../src/llm/user_message.js';
import type { CompleteResponse as CompleteResponseType, ChunkResponse } from '../../../src/llm/utils/response_types.js';

class DummyLLM extends BaseLLM {
  protected async _sendUserMessageToLLM(_userMessage: LLMUserMessage): Promise<CompleteResponseType> {
    return new CompleteResponse({ content: 'ok' });
  }

  protected async *_streamUserMessageToLLM(
    _userMessage: LLMUserMessage
  ): AsyncGenerator<ChunkResponse, void, unknown> {
    yield { content: 'ok', is_complete: true } as ChunkResponse;
  }
}

const makeContext = () => {
  const model = new LLMModel({
    name: 'dummy',
    value: 'dummy',
    canonical_name: 'dummy',
    provider: LLMProvider.OPENAI
  });
  const llm = new DummyLLM(model, new LLMConfig());
  const config = new AgentConfig('name', 'role', 'desc', llm);
  const state = new AgentRuntimeState('agent-1');
  return new AgentContext('agent-1', config, state);
};

const makeRuntimeStub = (context: AgentContext, isRunning: boolean) => {
  const runtime = Object.create(AgentRuntime.prototype) as AgentRuntime;
  runtime.context = context;
  runtime.start = vi.fn();
  runtime.stop = vi.fn(async () => undefined);
  runtime.submit_event = vi.fn(async () => undefined);
  Object.defineProperty(runtime, 'is_running', { get: () => isRunning });
  Object.defineProperty(runtime, 'current_status_property', { get: () => AgentStatus.IDLE, configurable: true });
  return runtime as AgentRuntime & { start: any; stop: any; submit_event: any };
};

describe('Agent', () => {
  it('delegates runtime start/stop', async () => {
    const context = makeContext();
    const runtime = makeRuntimeStub(context, false);
    const agent = new Agent(runtime as any);
    agent.start();
    expect(runtime.start).toHaveBeenCalledOnce();

    await agent.stop(0.5);
    expect(runtime.stop).toHaveBeenCalledWith(0.5);
  });

  it('submits user messages and starts runtime if needed', async () => {
    const context = makeContext();
    const runtime = makeRuntimeStub(context, false);
    const agent = new Agent(runtime as any);
    const message = new AgentInputUserMessage('hi');
    await agent.post_user_message(message);

    expect(runtime.start).toHaveBeenCalledOnce();
    expect(runtime.submit_event).toHaveBeenCalledOnce();
    const event = runtime.submit_event.mock.calls[0][0];
    expect(event).toBeInstanceOf(UserMessageReceivedEvent);
  });

  it('submits inter-agent messages', async () => {
    const context = makeContext();
    const runtime = makeRuntimeStub(context, true);
    const agent = new Agent(runtime as any);
    const message = new InterAgentMessage(
      'role',
      'to',
      'hello',
      InterAgentMessageType.CLARIFICATION,
      'from'
    );
    await agent.post_inter_agent_message(message);

    const event = runtime.submit_event.mock.calls[0][0];
    expect(event).toBeInstanceOf(InterAgentMessageReceivedEvent);
  });

  it('submits tool execution approvals', async () => {
    const context = makeContext();
    const runtime = makeRuntimeStub(context, true);
    const agent = new Agent(runtime as any);
    await agent.post_tool_execution_approval('tid-1', true, 'ok');

    const event = runtime.submit_event.mock.calls[0][0];
    expect(event).toBeInstanceOf(ToolExecutionApprovalEvent);
  });

  it('exposes status and running state', () => {
    const context = makeContext();
    const runtime = makeRuntimeStub(context, true);
    Object.defineProperty(runtime, 'current_status_property', { get: () => AgentStatus.ANALYZING_LLM_RESPONSE });
    const agent = new Agent(runtime as any);
    expect(agent.get_current_status()).toBe(AgentStatus.ANALYZING_LLM_RESPONSE);
    expect(agent.is_running).toBe(true);
  });
});
