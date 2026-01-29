import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentFactory } from '../../../../src/agent/factory/agent_factory.js';
import { AgentConfig } from '../../../../src/agent/context/agent_config.js';
import { AgentRuntime } from '../../../../src/agent/runtime/agent_runtime.js';
import { Agent } from '../../../../src/agent/agent.js';
import { EventHandlerRegistry } from '../../../../src/agent/handlers/event_handler_registry.js';
import { UserInputMessageEventHandler } from '../../../../src/agent/handlers/user_input_message_event_handler.js';
import { LifecycleEventLogger } from '../../../../src/agent/handlers/lifecycle_event_logger.js';
import { UserMessageReceivedEvent, AgentReadyEvent, AgentErrorEvent, AgentStoppedEvent } from '../../../../src/agent/events/agent_events.js';
import { BaseLLM } from '../../../../src/llm/base.js';
import { LLMModel } from '../../../../src/llm/models.js';
import { LLMProvider } from '../../../../src/llm/providers.js';
import { LLMConfig } from '../../../../src/llm/utils/llm_config.js';
import { CompleteResponse } from '../../../../src/llm/utils/response_types.js';
import { BaseTool } from '../../../../src/tools/base_tool.js';
import type { LLMUserMessage } from '../../../../src/llm/user_message.js';
import type { CompleteResponse as CompleteResponseType, ChunkResponse } from '../../../../src/llm/utils/response_types.js';

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

class DummyTool extends BaseTool {
  static getName(): string {
    return 'factory_tool';
  }

  static getDescription(): string {
    return 'Factory test tool';
  }

  static getArgumentSchema() {
    return null;
  }

  protected async _execute(): Promise<any> {
    return 'ok';
  }
}

const makeConfig = () => {
  const model = new LLMModel({
    name: 'dummy',
    value: 'dummy',
    canonical_name: 'dummy',
    provider: LLMProvider.OPENAI
  });
  const llm = new DummyLLM(model, new LLMConfig());
  return new AgentConfig('FactoryTestAgent', 'factory-tester', 'Test agent for factory', llm, null, [new DummyTool()]);
};

const resetFactory = () => {
  (AgentFactory as any).instance = undefined;
};

describe('AgentFactory', () => {
  beforeEach(() => {
    resetFactory();
  });

  afterEach(() => {
    resetFactory();
    vi.restoreAllMocks();
  });

  it('initializes without legacy dependencies', () => {
    const factory = new AgentFactory();
    expect(factory).toBeInstanceOf(AgentFactory);
    expect((factory as any).llm_factory).toBeUndefined();
    expect((factory as any).tool_registry).toBeUndefined();
  });

  it('builds the default event handler registry', () => {
    const factory = new AgentFactory();
    const registry = (factory as any)._get_default_event_handler_registry();
    expect(registry).toBeInstanceOf(EventHandlerRegistry);

    const handler = registry.get_handler(UserMessageReceivedEvent);
    expect(handler).toBeInstanceOf(UserInputMessageEventHandler);

    const lifecycleLogger = registry.get_handler(AgentReadyEvent);
    expect(lifecycleLogger).toBeInstanceOf(LifecycleEventLogger);
    expect(registry.get_handler(AgentStoppedEvent)).toBe(lifecycleLogger);
    expect(registry.get_handler(AgentErrorEvent)).toBe(lifecycleLogger);
  });

  it('creates agents and stores them', () => {
    const factory = new AgentFactory();
    const config = makeConfig();

    const runtimeStub = Object.create(AgentRuntime.prototype) as AgentRuntime;
    runtimeStub.context = { agent_id: '' } as any;

    const createRuntimeSpy = vi
      .spyOn(factory as any, '_create_runtime')
      .mockImplementation((...args: any[]) => {
        const agentId = String(args[0] ?? '');
        runtimeStub.context.agent_id = agentId;
        return runtimeStub;
      });

    const agent = factory.create_agent(config);

    expect(agent).toBeInstanceOf(Agent);
    expect(agent.agent_id.startsWith(`${config.name}_${config.role}`)).toBe(true);
    expect(createRuntimeSpy).toHaveBeenCalledWith(agent.agent_id, config);
    expect(factory.get_agent(agent.agent_id)).toBe(agent);
    expect(factory.list_active_agent_ids()).toContain(agent.agent_id);
  });

  it('rejects invalid config types', () => {
    const factory = new AgentFactory();
    expect(() => factory.create_agent('not a config' as any)).toThrow('Expected AgentConfig instance');
  });

  it('prepares tool instances by name', () => {
    const factory = new AgentFactory();
    const config = makeConfig();

    const toolInstances = (factory as any)._prepare_tool_instances('test-id', config) as Record<string, BaseTool>;
    expect(toolInstances.factory_tool).toBeInstanceOf(DummyTool);
  });

  it('warns and overwrites duplicate tool names', () => {
    const factory = new AgentFactory();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const config = makeConfig();
    config.tools = [new DummyTool(), new DummyTool()];

    const toolInstances = (factory as any)._prepare_tool_instances('test-id', config) as Record<string, BaseTool>;
    expect(warnSpy).toHaveBeenCalled();
    expect(toolInstances.factory_tool).toBeInstanceOf(DummyTool);
  });

  it('populates runtime state with LLM and tools', () => {
    const factory = new AgentFactory();
    const config = makeConfig();

    const runtime = (factory as any)._create_runtime('test-runtime-agent', config) as AgentRuntime;
    expect(runtime).toBeInstanceOf(AgentRuntime);
    expect(runtime.context.state.llm_instance).toBe(config.llm_instance);
    expect(runtime.context.state.tool_instances?.factory_tool).toBe(config.tools[0]);
  });
});
