import { InterAgentMessageType } from './inter_agent_message_type.js';

export class InterAgentMessage {
  recipient_role_name: string;
  recipient_agent_id: string;
  content: string;
  message_type: InterAgentMessageType;
  sender_agent_id: string;

  constructor(
    recipient_role_name: string,
    recipient_agent_id: string,
    content: string,
    message_type: InterAgentMessageType,
    sender_agent_id: string
  ) {
    this.recipient_role_name = recipient_role_name;
    this.recipient_agent_id = recipient_agent_id;
    this.content = content;
    this.message_type = message_type;
    this.sender_agent_id = sender_agent_id;
  }

  equals(other: unknown): boolean {
    if (!(other instanceof InterAgentMessage)) {
      return false;
    }
    return (
      this.recipient_role_name === other.recipient_role_name &&
      this.recipient_agent_id === other.recipient_agent_id &&
      this.content === other.content &&
      this.message_type === other.message_type &&
      this.sender_agent_id === other.sender_agent_id
    );
  }

  toString(): string {
    return (
      `InterAgentMessage(recipient_role_name='${this.recipient_role_name}', ` +
      `recipient_agent_id='${this.recipient_agent_id}', ` +
      `content='${this.content}', ` +
      `message_type=<${this.message_type.constructor.name}.${this.message_type.name}: '${this.message_type.value}'>, ` +
      `sender_agent_id='${this.sender_agent_id}')`
    );
  }

  static createWithDynamicMessageType(
    recipient_role_name: string,
    recipient_agent_id: string,
    content: string,
    message_type: string,
    sender_agent_id: string
  ): InterAgentMessage {
    if (!message_type) {
      throw new Error('message_type cannot be empty');
    }

    const normalized = message_type.toLowerCase();
    let msgType = InterAgentMessageType.getByValue(normalized) as InterAgentMessageType | undefined;
    if (!msgType) {
      msgType = InterAgentMessageType.add_type(message_type.toUpperCase(), normalized) ?? undefined;
    }

    if (!msgType) {
      throw new Error(`Failed to create or find InterAgentMessageType: ${message_type}`);
    }

    return new InterAgentMessage(recipient_role_name, recipient_agent_id, content, msgType, sender_agent_id);
  }
}
