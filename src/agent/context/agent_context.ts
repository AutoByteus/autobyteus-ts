import { AgentConfig } from './agent_config.js';
import { AgentRuntimeState } from './agent_runtime_state.js';
import { AgentStatus } from '../status/status_enum.js';
import { AgentInputEventQueueManager } from '../events/agent_input_event_queue_manager.js';
import { ToolInvocation } from '../tool_invocation.js';
import type { BaseLLM } from '../../llm/base.js';
import type { BaseTool } from '../../tools/base_tool.js';
import type { AgentEventStore } from '../events/event_store.js';
import type { BaseAgentWorkspace } from '../workspace/base_workspace.js';

import type { AgentStatusDeriver } from '../status/status_deriver.js';
import type { AgentStatusManager } from '../status/manager.js';

type MessagePayload = Record<string, any>;

export class AgentContext {
  agent_id: string;
  config: AgentConfig;
  state: AgentRuntimeState;

  constructor(agent_id: string, config: AgentConfig, state: AgentRuntimeState) {
    if (!agent_id || typeof agent_id !== 'string') {
      throw new Error("AgentContext requires a non-empty string 'agent_id'.");
    }
    if (!(config instanceof AgentConfig)) {
      throw new TypeError(`AgentContext 'config' must be an AgentConfig instance. Got ${typeof config}`);
    }
    if (!(state instanceof AgentRuntimeState)) {
      throw new TypeError(`AgentContext 'state' must be an AgentRuntimeState instance. Got ${typeof state}`);
    }

    if (agent_id !== state.agent_id) {
      console.warn(
        `AgentContext created with mismatched agent_id ('${agent_id}') and state's ID ('${state.agent_id}'). Using context's ID for logging.`
      );
    }

    this.agent_id = agent_id;
    this.config = config;
    this.state = state;

    console.info(`AgentContext composed for agent_id '${this.agent_id}'. Config and State linked.`);
  }

  get tool_instances(): Record<string, BaseTool> {
    return this.state.tool_instances ?? {};
  }

  get auto_execute_tools(): boolean {
    return this.config.auto_execute_tools;
  }

  get llm_instance(): BaseLLM | null {
    return this.state.llm_instance;
  }

  set llm_instance(value: BaseLLM | null) {
    this.state.llm_instance = value;
  }

  get input_event_queues(): AgentInputEventQueueManager {
    if (!this.state.input_event_queues) {
      console.error(
        `AgentContext for '${this.agent_id}': Attempted to access 'input_event_queues' before they were initialized by AgentWorker.`
      );
      throw new Error(
        `Agent '${this.agent_id}': Input event queues have not been initialized. This typically occurs during agent bootstrapping.`
      );
    }
    return this.state.input_event_queues;
  }

  get current_status(): AgentStatus {
    return this.state.current_status;
  }

  set current_status(value: AgentStatus) {
    if (!Object.values(AgentStatus).includes(value)) {
      throw new TypeError(`current_status must be an AgentStatus instance. Got ${typeof value}`);
    }
    this.state.current_status = value;
  }

  get status_manager(): AgentStatusManager | null {
    return this.state.status_manager_ref;
  }

  get event_store(): AgentEventStore | null {
    return this.state.event_store;
  }

  get status_deriver(): AgentStatusDeriver | null {
    return this.state.status_deriver;
  }

  get conversation_history(): MessagePayload[] {
    return this.state.conversation_history;
  }

  get pending_tool_approvals(): Record<string, ToolInvocation> {
    return this.state.pending_tool_approvals;
  }

  get custom_data(): Record<string, any> {
    return this.state.custom_data;
  }

  get workspace(): BaseAgentWorkspace | null {
    return this.state.workspace;
  }

  get processed_system_prompt(): string | null {
    return this.state.processed_system_prompt;
  }

  set processed_system_prompt(value: string | null) {
    this.state.processed_system_prompt = value;
  }

  add_message_to_history(message: MessagePayload): void {
    this.state.add_message_to_history(message);
  }

  get_tool(tool_name: string): BaseTool | undefined {
    const tool = this.tool_instances[tool_name];
    if (!tool) {
      console.warn(
        `Tool '${tool_name}' not found in AgentContext.state.tool_instances for agent '${this.agent_id}'. Available tools: ${Object.keys(this.tool_instances)}`
      );
    }
    return tool;
  }

  store_pending_tool_invocation(invocation: ToolInvocation): void {
    this.state.store_pending_tool_invocation(invocation);
  }

  retrieve_pending_tool_invocation(invocation_id: string): ToolInvocation | undefined {
    return this.state.retrieve_pending_tool_invocation(invocation_id);
  }

  toString(): string {
    const input_q_status = this.state.input_event_queues ? 'Initialized' : 'Pending Init';
    return (
      `AgentContext(agent_id='${this.agent_id}', ` +
      `current_status='${this.state.current_status}', ` +
      `llm_initialized=${this.state.llm_instance !== null}, ` +
      `tools_initialized=${this.state.tool_instances !== null}, ` +
      `input_queues_status='${input_q_status}')`
    );
  }
}
