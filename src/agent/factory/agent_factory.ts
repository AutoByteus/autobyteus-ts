import fs from 'fs';
import path from 'path';
import { Singleton } from '../../utils/singleton.js';
import { Agent } from '../agent.js';
import { AgentConfig } from '../context/agent_config.js';
import { AgentRuntimeState } from '../context/agent_runtime_state.js';
import { AgentContext } from '../context/agent_context.js';
import {
  UserMessageReceivedEvent,
  InterAgentMessageReceivedEvent,
  LLMCompleteResponseReceivedEvent,
  PendingToolInvocationEvent,
  ToolResultEvent,
  GenericEvent,
  ToolExecutionApprovalEvent,
  LLMUserMessageReadyEvent,
  ApprovedToolInvocationEvent,
  BootstrapStartedEvent,
  BootstrapStepRequestedEvent,
  BootstrapStepCompletedEvent,
  BootstrapCompletedEvent,
  AgentReadyEvent,
  AgentStoppedEvent,
  AgentIdleEvent,
  ShutdownRequestedEvent,
  AgentErrorEvent
} from '../events/agent_events.js';
import { BaseTool } from '../../tools/base_tool.js';
import { EventHandlerRegistry } from '../handlers/event_handler_registry.js';
import { UserInputMessageEventHandler } from '../handlers/user_input_message_event_handler.js';
import { InterAgentMessageReceivedEventHandler } from '../handlers/inter_agent_message_event_handler.js';
import { LLMCompleteResponseReceivedEventHandler } from '../handlers/llm_complete_response_received_event_handler.js';
import { ToolInvocationRequestEventHandler } from '../handlers/tool_invocation_request_event_handler.js';
import { ToolResultEventHandler } from '../handlers/tool_result_event_handler.js';
import { GenericEventHandler } from '../handlers/generic_event_handler.js';
import { ToolExecutionApprovalEventHandler } from '../handlers/tool_execution_approval_event_handler.js';
import { LLMUserMessageReadyEventHandler } from '../handlers/llm_user_message_ready_event_handler.js';
import { ApprovedToolInvocationEventHandler } from '../handlers/approved_tool_invocation_event_handler.js';
import { BootstrapEventHandler } from '../handlers/bootstrap_event_handler.js';
import { LifecycleEventLogger } from '../handlers/lifecycle_event_logger.js';
import { SkillRegistry } from '../../skills/registry.js';
import { AgentRuntime } from '../runtime/agent_runtime.js';
import { registerTools } from '../../tools/register_tools.js';
import { initializeLogging } from '../../utils/logger.js';

export class AgentFactory extends Singleton {
  private _active_agents: Map<string, Agent> = new Map();

  constructor() {
    super();
    const existing = (AgentFactory as any).instance as AgentFactory | undefined;
    if (existing) {
      return existing;
    }
    (AgentFactory as any).instance = this;
    initializeLogging();
    registerTools();
    console.info('AgentFactory (Singleton) initialized.');
  }

  private _get_default_event_handler_registry(): EventHandlerRegistry {
    const registry = new EventHandlerRegistry();
    registry.register(UserMessageReceivedEvent, new UserInputMessageEventHandler());
    registry.register(InterAgentMessageReceivedEvent, new InterAgentMessageReceivedEventHandler());
    registry.register(LLMCompleteResponseReceivedEvent, new LLMCompleteResponseReceivedEventHandler());
    registry.register(PendingToolInvocationEvent, new ToolInvocationRequestEventHandler());
    registry.register(ToolResultEvent, new ToolResultEventHandler());
    registry.register(GenericEvent, new GenericEventHandler());
    registry.register(ToolExecutionApprovalEvent, new ToolExecutionApprovalEventHandler());
    registry.register(LLMUserMessageReadyEvent, new LLMUserMessageReadyEventHandler());
    registry.register(ApprovedToolInvocationEvent, new ApprovedToolInvocationEventHandler());

    const bootstrapHandler = new BootstrapEventHandler();
    registry.register(BootstrapStartedEvent, bootstrapHandler);
    registry.register(BootstrapStepRequestedEvent, bootstrapHandler);
    registry.register(BootstrapStepCompletedEvent, bootstrapHandler);
    registry.register(BootstrapCompletedEvent, bootstrapHandler);

    const lifecycleLogger = new LifecycleEventLogger();
    registry.register(AgentReadyEvent, lifecycleLogger);
    registry.register(AgentStoppedEvent, lifecycleLogger);
    registry.register(AgentIdleEvent, lifecycleLogger);
    registry.register(ShutdownRequestedEvent, lifecycleLogger);
    registry.register(AgentErrorEvent, lifecycleLogger);
    return registry;
  }

  private _prepare_tool_instances(agent_id: string, config: AgentConfig): Record<string, BaseTool> {
    const toolInstances: Record<string, BaseTool> = {};
    if (!config.tools || config.tools.length === 0) {
      console.info(`Agent '${agent_id}': No tools provided in config.`);
      return toolInstances;
    }

    for (const toolInstance of config.tools) {
      const nameResolver = (toolInstance as any).getName;
      const instanceName =
        typeof nameResolver === 'function'
          ? (toolInstance as any).getName()
          : (toolInstance.constructor as typeof BaseTool).getName();

      if (toolInstances[instanceName]) {
        console.warn(
          `Agent '${agent_id}': Duplicate tool name '${instanceName}' encountered. The last one will be used.`
        );
      }

      toolInstances[instanceName] = toolInstance;
    }

    return toolInstances;
  }

  private _prepare_skills(agent_id: string, config: AgentConfig): void {
    const registry = new SkillRegistry();
    const updatedSkills: string[] = [];

    for (const skillItem of config.skills) {
      const isPath = path.isAbsolute(skillItem) || fs.existsSync(skillItem);
      if (isPath) {
        try {
          const skill = registry.registerSkillFromPath(skillItem);
          updatedSkills.push(skill.name);
        } catch (error) {
          console.error(
            `Agent '${agent_id}': Failed to register skill from path '${skillItem}': ${String(error)}`
          );
        }
      } else {
        updatedSkills.push(skillItem);
      }
    }

    config.skills = updatedSkills;
  }

  private _create_runtime(agent_id: string, config: AgentConfig): AgentRuntime {
    this._prepare_skills(agent_id, config);

    const runtimeState = new AgentRuntimeState(
      agent_id,
      config.workspace ?? null,
      null,
      config.initial_custom_data ?? null
    );

    runtimeState.llm_instance = config.llm_instance;
    runtimeState.tool_instances = this._prepare_tool_instances(agent_id, config);

    console.info(
      `Agent '${agent_id}': LLM instance '${config.llm_instance.constructor.name}' and ${Object.keys(runtimeState.tool_instances).length} tools prepared and stored in state.`
    );

    const context = new AgentContext(agent_id, config, runtimeState);
    const eventHandlerRegistry = this._get_default_event_handler_registry();

    console.info(`Instantiating AgentRuntime for agent_id: '${agent_id}' with config: '${config.name}'.`);
    return new AgentRuntime(context, eventHandlerRegistry);
  }

  create_agent(config: AgentConfig): Agent {
    let agent_id = `${config.name}_${config.role}_${Math.floor(Math.random() * 9000) + 1000}`;
    while (this._active_agents.has(agent_id)) {
      agent_id = `${config.name}_${config.role}_${Math.floor(Math.random() * 9000) + 1000}`;
    }

    const runtime = this._create_runtime(agent_id, config);
    const agent = new Agent(runtime);
    this._active_agents.set(agent_id, agent);
    console.info(`Agent '${agent_id}' created and stored successfully.`);
    return agent;
  }

  get_agent(agent_id: string): Agent | undefined {
    return this._active_agents.get(agent_id);
  }

  async remove_agent(agent_id: string, shutdown_timeout: number = 10.0): Promise<boolean> {
    const agent = this._active_agents.get(agent_id);
    if (!agent) {
      console.warn(`Agent with ID '${agent_id}' not found for removal.`);
      return false;
    }

    this._active_agents.delete(agent_id);
    console.info(`Removing agent '${agent_id}'. Attempting graceful shutdown.`);
    await agent.stop(shutdown_timeout);
    return true;
  }

  list_active_agent_ids(): string[] {
    return Array.from(this._active_agents.keys());
  }
}

export const defaultAgentFactory = AgentFactory.getInstance();
