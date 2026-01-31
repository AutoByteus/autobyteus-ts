import { AgentEventHandler } from './base-event-handler.js';
import { InterAgentMessageReceivedEvent, UserMessageReceivedEvent, BaseEvent } from '../events/agent-events.js';
import type { InterAgentMessage } from '../message/inter-agent-message.js';
import { AgentInputUserMessage } from '../message/agent-input-user-message.js';
import { SenderType } from '../sender-type.js';
import type { AgentContext } from '../context/agent-context.js';

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

    const interAgentMsg: InterAgentMessage = event.interAgentMessage;

    console.info(
      `Agent '${context.agentId}' handling InterAgentMessageReceivedEvent from sender ` +
        `'${interAgentMsg.senderAgentId}', type '${interAgentMsg.messageType.value}'. ` +
        `Content: '${interAgentMsg.content}'`
    );

    const notifier = context.statusManager?.notifier;
    if (notifier?.notifyAgentDataInterAgentMessageReceived) {
      notifier.notifyAgentDataInterAgentMessageReceived({
        sender_agent_id: interAgentMsg.senderAgentId,
        recipient_role_name: interAgentMsg.recipientRoleName,
        content: interAgentMsg.content,
        message_type: interAgentMsg.messageType.value
      });
    }

    const contentForLlm =
      'You have received a message from another agent.\n' +
      `Sender Agent ID: ${interAgentMsg.senderAgentId}\n` +
      `Message Type: ${interAgentMsg.messageType.value}\n` +
      `Recipient Role Name (intended for you): ${interAgentMsg.recipientRoleName}\n` +
      '--- Message Content ---\n' +
      `${interAgentMsg.content}\n` +
      '--- End of Message Content ---\n' +
      'Please process this information and act accordingly.';

    const agentInputUserMessage = new AgentInputUserMessage(
      contentForLlm,
      SenderType.AGENT,
      null,
      {
        sender_agent_id: interAgentMsg.senderAgentId,
        original_message_type: interAgentMsg.messageType.value
      }
    );

    const userMessageReceivedEvent = new UserMessageReceivedEvent(agentInputUserMessage);
    await context.inputEventQueues.enqueueUserMessage(userMessageReceivedEvent);

    console.info(
      `Agent '${context.agentId}' processed InterAgentMessage from sender '${interAgentMsg.senderAgentId}' ` +
        'and enqueued UserMessageReceivedEvent to route through input pipeline.'
    );
  }
}
