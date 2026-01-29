import { AgentInputUserMessage } from '../../agent/message/agent_input_user_message.js';
import { ProcessUserMessageEvent } from '../events/agent_team_events.js';
import { SenderType, TASK_NOTIFIER_SENDER_ID } from '../../agent/sender_type.js';

type TeamManagerLike = {
  team_id: string;
  ensure_node_is_ready: (name: string) => Promise<unknown>;
  dispatch_user_message_to_agent: (event: ProcessUserMessageEvent) => Promise<void>;
};

export class TaskActivator {
  _team_manager: TeamManagerLike;

  constructor(team_manager: TeamManagerLike) {
    if (!team_manager) {
      throw new Error('TaskActivator requires a valid TeamManager instance.');
    }
    this._team_manager = team_manager;
    console.debug(`TaskActivator initialized for team '${this._team_manager.team_id}'.`);
  }

  async activate_agent(agent_name: string): Promise<void> {
    const team_id = this._team_manager.team_id;
    try {
      console.info(`Team '${team_id}': TaskActivator is activating agent '${agent_name}'.`);

      await this._team_manager.ensure_node_is_ready(agent_name);

      const notification_message = new AgentInputUserMessage(
        'You have new tasks in your queue. Please review your task list using your tools and begin your work.',
        SenderType.SYSTEM,
        null,
        { sender_id: TASK_NOTIFIER_SENDER_ID }
      );

      const event = new ProcessUserMessageEvent(notification_message, agent_name);
      await this._team_manager.dispatch_user_message_to_agent(event);

      console.info(`Team '${team_id}': Successfully sent activation notification to '${agent_name}'.`);
    } catch (error) {
      console.error(`Team '${team_id}': Failed to activate agent '${agent_name}': ${error}`);
    }
  }
}
