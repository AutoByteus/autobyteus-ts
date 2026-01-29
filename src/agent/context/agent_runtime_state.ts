import { AgentInputEventQueueManager } from '../events/agent_input_event_queue_manager.js';
import { AgentEventStore } from '../events/event_store.js';
import { AgentStatus } from '../status/status_enum.js';
import { BaseAgentWorkspace } from '../workspace/base_workspace.js';
import { ToolInvocation, ToolInvocationTurn } from '../tool_invocation.js';
import { ToDoList } from '../../task_management/todo_list.js';
import { BaseLLM } from '../../llm/base.js';
import type { BaseTool } from '../../tools/base_tool.js';

import type { AgentStatusDeriver } from '../status/status_deriver.js';
import type { AgentStatusManager } from '../status/manager.js';

type MessagePayload = Record<string, any>;

type ToolInstances = Record<string, BaseTool>;

export class AgentRuntimeState {
  agent_id: string;
  current_status: AgentStatus;
  llm_instance: BaseLLM | null = null;
  tool_instances: ToolInstances | null = null;
  input_event_queues: AgentInputEventQueueManager | null = null;
  event_store: AgentEventStore | null = null;
  status_deriver: AgentStatusDeriver | null = null;
  workspace: BaseAgentWorkspace | null;
  conversation_history: MessagePayload[];
  pending_tool_approvals: Record<string, ToolInvocation>;
  custom_data: Record<string, any>;
  active_multi_tool_call_turn: ToolInvocationTurn | null = null;
  todo_list: ToDoList | null = null;
  processed_system_prompt: string | null = null;
  status_manager_ref: AgentStatusManager | null = null;

  constructor(
    agent_id: string,
    workspace: BaseAgentWorkspace | null = null,
    conversation_history: MessagePayload[] | null = null,
    custom_data: Record<string, any> | null = null
  ) {
    if (!agent_id || typeof agent_id !== 'string') {
      throw new Error("AgentRuntimeState requires a non-empty string 'agent_id'.");
    }
    if (workspace !== null && !(workspace instanceof BaseAgentWorkspace)) {
      throw new TypeError(
        `AgentRuntimeState 'workspace' must be a BaseAgentWorkspace or null. Got ${typeof workspace}`
      );
    }

    this.agent_id = agent_id;
    this.current_status = AgentStatus.UNINITIALIZED;
    this.workspace = workspace;
    this.conversation_history = conversation_history ?? [];
    this.pending_tool_approvals = {};
    this.custom_data = custom_data ?? {};

    console.info(
      `AgentRuntimeState initialized for agent_id '${this.agent_id}'. Initial status: ${this.current_status}. Workspace linked. InputQueues pending initialization. Output data via notifier.`
    );
  }

  add_message_to_history(message: MessagePayload): void {
    if (!message || typeof message !== 'object' || !('role' in message)) {
      console.warn(
        `Attempted to add malformed message to history for agent '${this.agent_id}': ${JSON.stringify(message)}`
      );
      return;
    }
    this.conversation_history.push(message);
    console.debug(`Message added to history for agent '${this.agent_id}': role=${message.role}`);
  }

  store_pending_tool_invocation(invocation: ToolInvocation): void {
    if (!(invocation instanceof ToolInvocation) || !invocation.id) {
      console.error(
        `Agent '${this.agent_id}': Attempted to store invalid ToolInvocation for approval: ${invocation}`
      );
      return;
    }
    this.pending_tool_approvals[invocation.id] = invocation;
    console.info(
      `Agent '${this.agent_id}': Stored pending tool invocation '${invocation.id}' (${invocation.name}).`
    );
  }

  retrieve_pending_tool_invocation(invocation_id: string): ToolInvocation | undefined {
    const invocation = this.pending_tool_approvals[invocation_id];
    if (invocation) {
      delete this.pending_tool_approvals[invocation_id];
      console.info(
        `Agent '${this.agent_id}': Retrieved pending tool invocation '${invocation_id}' (${invocation.name}).`
      );
      return invocation;
    }
    console.warn(`Agent '${this.agent_id}': Pending tool invocation '${invocation_id}' not found.`);
    return undefined;
  }

  toString(): string {
    const llm_status = this.llm_instance ? 'Initialized' : 'Not Initialized';
    const tools_status = this.tool_instances ? `${Object.keys(this.tool_instances).length} Initialized` : 'Not Initialized';
    const input_queues_status = this.input_event_queues ? 'Initialized' : 'Not Initialized';
    const active_turn_status = this.active_multi_tool_call_turn ? 'Active' : 'Inactive';

    return (
      `AgentRuntimeState(agent_id='${this.agent_id}', current_status='${this.current_status}', ` +
      `llm_status='${llm_status}', tools_status='${tools_status}', ` +
      `input_queues_status='${input_queues_status}', ` +
      `pending_approvals=${Object.keys(this.pending_tool_approvals).length}, ` +
      `history_len=${this.conversation_history.length}, ` +
      `multi_tool_call_turn='${active_turn_status}')`
    );
  }
}
