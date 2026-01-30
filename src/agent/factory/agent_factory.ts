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
  protected static instance?: AgentFactory;

  private activeAgents: Map<string, Agent> = new Map();

  constructor() {
    super();
    if (AgentFactory.instance) {
      return AgentFactory.instance;
    }
    AgentFactory.instance = this;
    initializeLogging();
    registerTools();
    console.info('AgentFactory (Singleton) initialized.');
  }

  private getDefaultEventHandlerRegistry(): EventHandlerRegistry {
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

  private prepareToolInstances(agentId: string, config: AgentConfig): Record<string, BaseTool> {
    const toolInstances: Record<string, BaseTool> = {};
    if (!config.tools || config.tools.length === 0) {
      console.info(`Agent '${agentId}': No tools provided in config.`);
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
          `Agent '${agentId}': Duplicate tool name '${instanceName}' encountered. The last one will be used.`
        );
      }

      toolInstances[instanceName] = toolInstance;
    }

    return toolInstances;
  }

  private prepareSkills(agentId: string, config: AgentConfig): void {
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
            `Agent '${agentId}': Failed to register skill from path '${skillItem}': ${String(error)}`
          );
        }
      } else {
        updatedSkills.push(skillItem);
      }
    }

    config.skills = updatedSkills;
  }

  private createRuntime(agentId: string, config: AgentConfig): AgentRuntime {
    this.prepareSkills(agentId, config);

    const runtimeState = new AgentRuntimeState(
      agentId,
      config.workspace ?? null,
      null,
      config.initialCustomData ?? null
    );

    runtimeState.llmInstance = config.llmInstance;
    runtimeState.toolInstances = this.prepareToolInstances(agentId, config);

    console.info(
      `Agent '${agentId}': LLM instance '${config.llmInstance.constructor.name}' and ${Object.keys(runtimeState.toolInstances).length} tools prepared and stored in state.`
    );

    const context = new AgentContext(agentId, config, runtimeState);
    const eventHandlerRegistry = this.getDefaultEventHandlerRegistry();

    console.info(`Instantiating AgentRuntime for agent_id: '${agentId}' with config: '${config.name}'.`);
    return new AgentRuntime(context, eventHandlerRegistry);
  }

  createAgent(config: AgentConfig): Agent {
    if (!(config instanceof AgentConfig)) {
      throw new TypeError(`Expected AgentConfig instance, got ${String(config)}`);
    }

    let agentId = `${config.name}_${config.role}_${Math.floor(Math.random() * 9000) + 1000}`;
    while (this.activeAgents.has(agentId)) {
      agentId = `${config.name}_${config.role}_${Math.floor(Math.random() * 9000) + 1000}`;
    }

    const runtime = this.createRuntime(agentId, config);
    const agent = new Agent(runtime);
    this.activeAgents.set(agentId, agent);
    console.info(`Agent '${agentId}' created and stored successfully.`);
    return agent;
  }

  getAgent(agentId: string): Agent | undefined {
    return this.activeAgents.get(agentId);
  }

  async removeAgent(agentId: string, shutdownTimeout: number = 10.0): Promise<boolean> {
    const agent = this.activeAgents.get(agentId);
    if (!agent) {
      console.warn(`Agent with ID '${agentId}' not found for removal.`);
      return false;
    }

    this.activeAgents.delete(agentId);
    console.info(`Removing agent '${agentId}'. Attempting graceful shutdown.`);
    await agent.stop(shutdownTimeout);
    return true;
  }

  listActiveAgentIds(): string[] {
    return Array.from(this.activeAgents.keys());
  }
}

export const defaultAgentFactory = AgentFactory.getInstance();
