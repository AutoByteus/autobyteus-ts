import { AgentEventHandler } from './base_event_handler.js';
import { InterAgentMessageReceivedEvent, UserMessageReceivedEvent, BaseEvent } from '../events/agent_events.js';
import type { InterAgentMessage } from '../message/inter_agent_message.js';
import { AgentInputUserMessage } from '../message/agent_input_user_message.js';
import { SenderType } from '../sender_type.js';
import type { AgentContext } from '../context/agent_context.js';

export class InterAgentMessageReceivedEventHandler extends AgentEventHandler {
  constructor() {
    super();
    console.info('InterAgentMessageReceivedEventHandler initialized.');
  }

  async handle(event: BaseEvent, context: AgentContext): Promise<void> {
    if (!(event instanceof InterAgentMessageReceivedEvent)) {
      const eventType = event?.constructor?.name ?? typeof event;
      console.warn(
        `InterAgentMessageReceivedEventHandler received an event of type ${eventType} instead of InterAgentMessageReceivedEvent. Skipping.`
      );
      return;
    }

    const interAgentMsg: InterAgentMessage = event.inter_agent_message;

    console.info(
      `Agent '${context.agent_id}' handling InterAgentMessageReceivedEvent from sender ` +
        `'${interAgentMsg.sender_agent_id}', type '${interAgentMsg.message_type.value}'. ` +
        `Content: '${interAgentMsg.content}'`
    );

    const notifier = context.status_manager?.notifier;
    if (notifier?.notify_agent_data_inter_agent_message_received) {
      notifier.notify_agent_data_inter_agent_message_received({
        sender_agent_id: interAgentMsg.sender_agent_id,
        recipient_role_name: interAgentMsg.recipient_role_name,
        content: interAgentMsg.content,
        message_type: interAgentMsg.message_type.value
      });
    }

    const contentForLlm =
      'You have received a message from another agent.\n' +
      `Sender Agent ID: ${interAgentMsg.sender_agent_id}\n` +
      `Message Type: ${interAgentMsg.message_type.value}\n` +
      `Recipient Role Name (intended for you): ${interAgentMsg.recipient_role_name}\n` +
      '--- Message Content ---\n' +
      `${interAgentMsg.content}\n` +
      '--- End of Message Content ---\n' +
      'Please process this information and act accordingly.';

    const agentInputUserMessage = new AgentInputUserMessage(
      contentForLlm,
      SenderType.AGENT,
      null,
      {
        sender_agent_id: interAgentMsg.sender_agent_id,
        original_message_type: interAgentMsg.message_type.value
      }
    );

    const userMessageReceivedEvent = new UserMessageReceivedEvent(agentInputUserMessage);
    await context.input_event_queues.enqueue_user_message(userMessageReceivedEvent);

    console.info(
      `Agent '${context.agent_id}' processed InterAgentMessage from sender '${interAgentMsg.sender_agent_id}' ` +
        'and enqueued UserMessageReceivedEvent to route through input pipeline.'
    );
  }
}
