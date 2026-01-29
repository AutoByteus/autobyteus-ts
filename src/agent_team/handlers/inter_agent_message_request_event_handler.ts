import { BaseAgentTeamEventHandler } from './base_agent_team_event_handler.js';
import { InterAgentMessageRequestEvent, AgentTeamErrorEvent } from '../events/agent_team_events.js';
import { InterAgentMessage } from '../../agent/message/inter_agent_message.js';
import { AgentInputUserMessage } from '../../agent/message/agent_input_user_message.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';

export class InterAgentMessageRequestEventHandler extends BaseAgentTeamEventHandler {
  async handle(event: InterAgentMessageRequestEvent, context: AgentTeamContext): Promise<void> {
    const team_id = context.team_id;
    const team_manager: any = context.team_manager;

    if (!team_manager) {
      const message =
        `Team '${team_id}': TeamManager not found. Cannot route message from ` +
        `'${event.sender_agent_id}' to '${event.recipient_name}'.`;
      console.error(message);
      if (context.state.input_event_queues) {
        await context.state.input_event_queues.enqueue_internal_system_event(
          new AgentTeamErrorEvent(message, 'TeamManager is not initialized.')
        );
      }
      return;
    }

    let target_node: any;
    try {
      target_node = await team_manager.ensure_node_is_ready(event.recipient_name);
    } catch (error) {
      const msg =
        `Recipient node '${event.recipient_name}' not found or failed to start ` +
        `for message from '${event.sender_agent_id}'. Error: ${error}`;
      console.error(`Team '${team_id}': ${msg}`);
      if (context.state.input_event_queues) {
        await context.state.input_event_queues.enqueue_internal_system_event(
          new AgentTeamErrorEvent(
            `Team '${team_id}': ${msg}`,
            `Node '${event.recipient_name}' not found or failed to start.`
          )
        );
      }
      return;
    }

    try {
      if (target_node && typeof target_node.post_message === 'function') {
        const message_for_team = new AgentInputUserMessage(event.content);
        await target_node.post_message(message_for_team);
        console.info(
          `Team '${team_id}': Successfully posted message from ` +
          `'${event.sender_agent_id}' to sub-team '${event.recipient_name}'.`
        );
        return;
      }

      if (target_node && typeof target_node.post_inter_agent_message === 'function') {
        const recipient_role = target_node.context?.config?.role ?? '';
        const recipient_agent_id = target_node.agent_id ?? '';
        const message_for_agent = InterAgentMessage.createWithDynamicMessageType(
          recipient_role,
          recipient_agent_id,
          event.content,
          event.message_type,
          event.sender_agent_id
        );
        await target_node.post_inter_agent_message(message_for_agent);
        console.info(
          `Team '${team_id}': Successfully posted message from ` +
          `'${event.sender_agent_id}' to agent '${event.recipient_name}'.`
        );
        return;
      }

      throw new TypeError(
        `Target node '${event.recipient_name}' is of an unsupported type: ${typeof target_node}`
      );
    } catch (error) {
      const msg = `Error posting message to node '${event.recipient_name}': ${error}`;
      console.error(`Team '${team_id}': ${msg}`);
      if (context.state.input_event_queues) {
        await context.state.input_event_queues.enqueue_internal_system_event(
          new AgentTeamErrorEvent(
            `Team '${team_id}': ${msg}`,
            'Message delivery failed.'
          )
        );
      }
    }
  }
}
