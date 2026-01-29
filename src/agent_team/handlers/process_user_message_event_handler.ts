import { BaseAgentTeamEventHandler } from './base_agent_team_event_handler.js';
import { ProcessUserMessageEvent, AgentTeamErrorEvent } from '../events/agent_team_events.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';

export class ProcessUserMessageEventHandler extends BaseAgentTeamEventHandler {
  async handle(event: ProcessUserMessageEvent, context: AgentTeamContext): Promise<void> {
    const team_manager: any = context.team_manager;
    if (!team_manager) {
      const message = `Team '${context.team_id}': TeamManager not found. Cannot route message.`;
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
      target_node = await team_manager.ensure_node_is_ready(event.target_agent_name);
    } catch (error) {
      const message =
        `Team '${context.team_id}': Node '${event.target_agent_name}' not found or failed to start. ` +
        `Cannot route message. Error: ${error}`;
      console.error(message);
      if (context.state.input_event_queues) {
        await context.state.input_event_queues.enqueue_internal_system_event(
          new AgentTeamErrorEvent(
            message,
            `Node '${event.target_agent_name}' not found or failed to start.`
          )
        );
      }
      return;
    }

    if (target_node && typeof target_node.post_user_message === 'function') {
      await target_node.post_user_message(event.user_message);
      console.info(`Team '${context.team_id}': Routed user message to agent node '${event.target_agent_name}'.`);
      return;
    }

    if (target_node && typeof target_node.post_message === 'function') {
      await target_node.post_message(event.user_message);
      console.info(`Team '${context.team_id}': Routed user message to sub-team node '${event.target_agent_name}'.`);
      return;
    }

    const message = `Target node '${event.target_agent_name}' is of an unsupported type: ${typeof target_node}`;
    console.error(`Team '${context.team_id}': ${message}`);
    if (context.state.input_event_queues) {
      await context.state.input_event_queues.enqueue_internal_system_event(
        new AgentTeamErrorEvent(message, '')
      );
    }
  }
}
