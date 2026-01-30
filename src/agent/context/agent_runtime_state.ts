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
  agentId: string;
  currentStatus: AgentStatus;
  llmInstance: BaseLLM | null = null;
  toolInstances: ToolInstances | null = null;
  inputEventQueues: AgentInputEventQueueManager | null = null;
  eventStore: AgentEventStore | null = null;
  statusDeriver: AgentStatusDeriver | null = null;
  workspace: BaseAgentWorkspace | null;
  conversationHistory: MessagePayload[];
  pendingToolApprovals: Record<string, ToolInvocation>;
  customData: Record<string, any>;
  activeMultiToolCallTurn: ToolInvocationTurn | null = null;
  todoList: ToDoList | null = null;
  processedSystemPrompt: string | null = null;
  statusManagerRef: AgentStatusManager | null = null;

  constructor(
    agentId: string,
    workspace: BaseAgentWorkspace | null = null,
    conversationHistory: MessagePayload[] | null = null,
    customData: Record<string, any> | null = null
  ) {
    if (!agentId || typeof agentId !== 'string') {
      throw new Error("AgentRuntimeState requires a non-empty string 'agentId'.");
    }
    if (workspace !== null && !(workspace instanceof BaseAgentWorkspace)) {
      throw new TypeError(
        `AgentRuntimeState 'workspace' must be a BaseAgentWorkspace or null. Got ${typeof workspace}`
      );
    }

    this.agentId = agentId;
    this.currentStatus = AgentStatus.UNINITIALIZED;
    this.workspace = workspace;
    this.conversationHistory = conversationHistory ?? [];
    this.pendingToolApprovals = {};
    this.customData = customData ?? {};

    console.info(
      `AgentRuntimeState initialized for agent_id '${this.agentId}'. Initial status: ${this.currentStatus}. Workspace linked. InputQueues pending initialization. Output data via notifier.`
    );
  }

  addMessageToHistory(message: MessagePayload): void {
    if (!message || typeof message !== 'object' || !('role' in message)) {
      console.warn(
        `Attempted to add malformed message to history for agent '${this.agentId}': ${JSON.stringify(message)}`
      );
      return;
    }
    this.conversationHistory.push(message);
    console.debug(`Message added to history for agent '${this.agentId}': role=${message.role}`);
  }

  storePendingToolInvocation(invocation: ToolInvocation): void {
    if (!(invocation instanceof ToolInvocation) || !invocation.id) {
      console.error(
        `Agent '${this.agentId}': Attempted to store invalid ToolInvocation for approval: ${invocation}`
      );
      return;
    }
    this.pendingToolApprovals[invocation.id] = invocation;
    console.info(
      `Agent '${this.agentId}': Stored pending tool invocation '${invocation.id}' (${invocation.name}).`
    );
  }

  retrievePendingToolInvocation(invocationId: string): ToolInvocation | undefined {
    const invocation = this.pendingToolApprovals[invocationId];
    if (invocation) {
      delete this.pendingToolApprovals[invocationId];
      console.info(
        `Agent '${this.agentId}': Retrieved pending tool invocation '${invocationId}' (${invocation.name}).`
      );
      return invocation;
    }
    console.warn(`Agent '${this.agentId}': Pending tool invocation '${invocationId}' not found.`);
    return undefined;
  }

  toString(): string {
    const llmStatus = this.llmInstance ? 'Initialized' : 'Not Initialized';
    const toolsStatus = this.toolInstances ? `${Object.keys(this.toolInstances).length} Initialized` : 'Not Initialized';
    const inputQueuesStatus = this.inputEventQueues ? 'Initialized' : 'Not Initialized';
    const activeTurnStatus = this.activeMultiToolCallTurn ? 'Active' : 'Inactive';

    return (
      `AgentRuntimeState(agentId='${this.agentId}', currentStatus='${this.currentStatus}', ` +
      `llmStatus='${llmStatus}', toolsStatus='${toolsStatus}', ` +
      `inputQueuesStatus='${inputQueuesStatus}', ` +
      `pendingApprovals=${Object.keys(this.pendingToolApprovals).length}, ` +
      `historyLen=${this.conversationHistory.length}, ` +
      `multiToolCallTurn='${activeTurnStatus}')`
    );
  }
}
