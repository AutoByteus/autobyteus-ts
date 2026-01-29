import { AgentEventHandler } from './base_event_handler.js';
import {
  ToolExecutionApprovalEvent,
  ApprovedToolInvocationEvent,
  LLMUserMessageReadyEvent,
  BaseEvent
} from '../events/agent_events.js';
import { LLMUserMessage } from '../../llm/user_message.js';
import type { AgentContext } from '../context/agent_context.js';

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
      `Agent '${context.agent_id}' handling ToolExecutionApprovalEvent for ` +
        `tool_invocation_id '${event.tool_invocation_id}': Approved=${event.is_approved}, ` +
        `Reason='${event.reason ? event.reason : 'N/A'}'.`
    );

    const retrievedInvocation = context.state.retrieve_pending_tool_invocation(event.tool_invocation_id);
    if (!retrievedInvocation) {
      console.warn(
        `Agent '${context.agent_id}': No pending tool invocation found for ID '${event.tool_invocation_id}'. ` +
          'Cannot proceed with approval/denial.'
      );
      return;
    }

    if (event.is_approved) {
      console.info(
        `Agent '${context.agent_id}': Tool invocation '${retrievedInvocation.name}' ` +
          `(ID: ${event.tool_invocation_id}) was APPROVED. Reason: '${event.reason ? event.reason : 'None'}'. ` +
          'Enqueuing ApprovedToolInvocationEvent for execution.'
      );
      const approvedEvent = new ApprovedToolInvocationEvent(retrievedInvocation);
      await context.input_event_queues.enqueue_internal_system_event(approvedEvent);
      console.debug(
        `Agent '${context.agent_id}': Enqueued ApprovedToolInvocationEvent for '${retrievedInvocation.name}' ` +
          `(ID: ${event.tool_invocation_id}).`
      );
      return;
    }

    console.warn(
      `Agent '${context.agent_id}': Tool invocation '${retrievedInvocation.name}' ` +
        `(ID: ${event.tool_invocation_id}) was DENIED. Reason: '${event.reason ? event.reason : 'None'}'. ` +
        'Informing LLM.'
    );

    const denialReason = event.reason ?? 'No specific reason provided.';
    const denialContent = `Tool execution denied by user/system. Reason: ${denialReason}`;
    context.state.add_message_to_history({
      role: 'tool',
      tool_call_id: event.tool_invocation_id,
      name: retrievedInvocation.name,
      content: denialContent
    });
    console.debug(
      `Agent '${context.agent_id}': Added 'tool' role denial message to history for ` +
        `'${retrievedInvocation.name}' (ID: ${event.tool_invocation_id}).`
    );

    const promptContentForLlm =
      `The request to use the tool '${retrievedInvocation.name}' ` +
      `(with arguments: ${JSON.stringify(retrievedInvocation.arguments ?? {})}) was denied. ` +
      `Denial reason: '${denialReason}'. ` +
      'Please analyze this outcome and the conversation history, then decide on the next course of action.';
    const llmUserMessage = new LLMUserMessage({ content: promptContentForLlm });
    const llmUserMessageReadyEvent = new LLMUserMessageReadyEvent(llmUserMessage);
    await context.input_event_queues.enqueue_internal_system_event(llmUserMessageReadyEvent);
    console.debug(
      `Agent '${context.agent_id}': Enqueued LLMUserMessageReadyEvent to inform LLM of tool denial for ` +
        `'${retrievedInvocation.name}' (ID: ${event.tool_invocation_id}).`
    );
  }
}
