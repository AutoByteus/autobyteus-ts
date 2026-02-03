import { AgentEventHandler } from './base-event-handler.js';
import {
  ToolExecutionApprovalEvent,
  ApprovedToolInvocationEvent,
  LLMUserMessageReadyEvent,
  BaseEvent
} from '../events/agent-events.js';
import { LLMUserMessage } from '../../llm/user-message.js';
import type { AgentContext } from '../context/agent-context.js';

export class ToolExecutionApprovalEventHandler extends AgentEventHandler {
  constructor() {
    super();
    console.info('ToolExecutionApprovalEventHandler initialized.');
  }

  async handle(event: BaseEvent, context: AgentContext): Promise<void> {
    if (!(event instanceof ToolExecutionApprovalEvent)) {
      const eventType = event?.constructor?.name ?? typeof event;
      console.warn(
        `ToolExecutionApprovalEventHandler received non-ToolExecutionApprovalEvent: ${eventType}. Skipping.`
      );
      return;
    }

    console.info(
      `Agent '${context.agentId}' handling ToolExecutionApprovalEvent for ` +
        `tool_invocation_id '${event.toolInvocationId}': Approved=${event.isApproved}, ` +
        `Reason='${event.reason ? event.reason : 'N/A'}'.`
    );

    const retrievedInvocation = context.state.retrievePendingToolInvocation(event.toolInvocationId);
    if (!retrievedInvocation) {
      console.warn(
        `Agent '${context.agentId}': No pending tool invocation found for ID '${event.toolInvocationId}'. ` +
          'Cannot proceed with approval/denial.'
      );
      return;
    }

    if (event.isApproved) {
      console.info(
        `Agent '${context.agentId}': Tool invocation '${retrievedInvocation.name}' ` +
          `(ID: ${event.toolInvocationId}) was APPROVED. Reason: '${event.reason ? event.reason : 'None'}'. ` +
          'Enqueuing ApprovedToolInvocationEvent for execution.'
      );
      const approvedEvent = new ApprovedToolInvocationEvent(retrievedInvocation);
      await context.inputEventQueues.enqueueInternalSystemEvent(approvedEvent);
      console.debug(
        `Agent '${context.agentId}': Enqueued ApprovedToolInvocationEvent for '${retrievedInvocation.name}' ` +
          `(ID: ${event.toolInvocationId}).`
      );
      return;
    }

    console.warn(
      `Agent '${context.agentId}': Tool invocation '${retrievedInvocation.name}' ` +
        `(ID: ${event.toolInvocationId}) was DENIED. Reason: '${event.reason ? event.reason : 'None'}'. ` +
        'Informing LLM.'
    );

    const denialReason = event.reason ?? 'No specific reason provided.';
    const denialContent = `Tool execution denied by user/system. Reason: ${denialReason}`;

    const promptContentForLlm =
      `The request to use the tool '${retrievedInvocation.name}' ` +
      `(with arguments: ${JSON.stringify(retrievedInvocation.arguments ?? {})}) was denied. ` +
      `Denial reason: '${denialReason}'. ` +
      'Please analyze this outcome and the conversation history, then decide on the next course of action.';
    const llmUserMessage = new LLMUserMessage({ content: promptContentForLlm });
    const llmUserMessageReadyEvent = new LLMUserMessageReadyEvent(llmUserMessage);
    await context.inputEventQueues.enqueueInternalSystemEvent(llmUserMessageReadyEvent);
    console.debug(
      `Agent '${context.agentId}': Enqueued LLMUserMessageReadyEvent to inform LLM of tool denial for ` +
        `'${retrievedInvocation.name}' (ID: ${event.toolInvocationId}).`
    );
  }
}
