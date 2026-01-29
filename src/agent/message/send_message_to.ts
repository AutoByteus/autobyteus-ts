import { BaseTool } from '../../tools/base_tool.js';
import { ToolCategory } from '../../tools/tool_category.js';
import { ParameterSchema, ParameterDefinition, ParameterType } from '../../utils/parameter_schema.js';
import { InterAgentMessageRequestEvent } from '../../agent_team/events/agent_team_events.js';
import type { ToolConfig } from '../../tools/tool_config.js';

export class SendMessageTo extends BaseTool {
  static TOOL_NAME = 'send_message_to';
  static CATEGORY = ToolCategory.AGENT_COMMUNICATION;

  constructor(config?: ToolConfig) {
    super(config);
  }

  static getName(): string {
    return SendMessageTo.TOOL_NAME;
  }

  static getDescription(): string {
    return (
      'Sends a message to another agent within the same team, starting them if necessary. ' +
      'You must specify the recipient by their unique name as provided in your team manifest.'
    );
  }

  static getArgumentSchema(): ParameterSchema {
    const schema = new ParameterSchema();
    schema.addParameter(new ParameterDefinition({
      name: 'recipient_name',
      type: ParameterType.STRING,
      description:
        'The unique name of the recipient agent (e.g., "Researcher", "Writer_1"). This MUST match a name from your team manifest.',
      required: true
    }));
    schema.addParameter(new ParameterDefinition({
      name: 'content',
      type: ParameterType.STRING,
      description: 'The actual message content or task instruction.',
      required: true
    }));
    schema.addParameter(new ParameterDefinition({
      name: 'message_type',
      type: ParameterType.STRING,
      description: 'Type of the message (e.g., TASK_ASSIGNMENT, CLARIFICATION). Custom types allowed.',
      required: true
    }));
    return schema;
  }

  protected async _execute(context: any, kwargs: Record<string, any> = {}): Promise<string> {
    const teamContext = context?.custom_data?.team_context;
    if (!teamContext) {
      const errorMsg =
        `Critical error: ${this.getName()} tool is not configured for team communication. ` +
        'It can only be used within a managed AgentTeam.';
      return `Error: ${errorMsg}`;
    }

    const teamManager = teamContext.team_manager;
    if (!teamManager) {
      return 'Error: Internal Error: TeamManager not found in the provided team_context.';
    }

    const recipientName = kwargs.recipient_name;
    const content = kwargs.content;
    const messageType = kwargs.message_type;

    if (typeof recipientName !== 'string' || !recipientName.trim()) {
      return 'Error: `recipient_name` must be a non-empty string.';
    }
    if (typeof content !== 'string' || !content.trim()) {
      return 'Error: `content` must be a non-empty string.';
    }
    if (typeof messageType !== 'string' || !messageType.trim()) {
      return 'Error: `message_type` must be a non-empty string.';
    }

    const senderAgentId = context?.agent_id ?? context?.agentId ?? 'unknown';

    const event = new InterAgentMessageRequestEvent(
      senderAgentId,
      recipientName,
      content,
      messageType
    );

    await teamManager.dispatch_inter_agent_message_request(event);

    return `Message dispatch for recipient '${recipientName}' has been successfully requested.`;
  }
}
