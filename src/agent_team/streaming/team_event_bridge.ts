import { AgentTeamEventStream } from './agent_team_event_stream.js';
import type { AgentTeamExternalEventNotifier } from './agent_team_event_notifier.js';
import type { AgentTeamStreamEvent } from './agent_team_stream_events.js';

type TeamLike = { team_id: string } | Record<string, any>;

type BridgeOptions = { stream?: AgentTeamEventStream };

const resolveOptions = (loopOrOptions?: unknown, maybeOptions?: BridgeOptions): BridgeOptions | undefined => {
  if (loopOrOptions && typeof loopOrOptions === 'object' && 'stream' in (loopOrOptions as BridgeOptions)) {
    return loopOrOptions as BridgeOptions;
  }
  return maybeOptions;
};

export class TeamEventBridge {
  private sub_team_node_name: string;
  private parent_notifier: AgentTeamExternalEventNotifier;
  private stream: AgentTeamEventStream;
  private cancelled = false;
  _task: Promise<void>;

  constructor(
    sub_team: TeamLike,
    sub_team_node_name: string,
    parent_notifier: AgentTeamExternalEventNotifier,
    loopOrOptions?: unknown,
    maybeOptions?: BridgeOptions
  ) {
    this.sub_team_node_name = sub_team_node_name;
    this.parent_notifier = parent_notifier;

    const options = resolveOptions(loopOrOptions, maybeOptions);
    this.stream = options?.stream ?? new AgentTeamEventStream(sub_team as any);

    this._task = this.run();
    console.info(`TeamEventBridge created and task started for sub-team '${sub_team_node_name}'.`);
  }

  private async run(): Promise<void> {
    try {
      for await (const event of this.stream.all_events()) {
        if (this.cancelled) {
          break;
        }
        this.parent_notifier.publish_sub_team_event(this.sub_team_node_name, event as AgentTeamStreamEvent);
      }
    } catch (error) {
      if (this.cancelled) {
        console.info(`TeamEventBridge task for '${this.sub_team_node_name}' was cancelled.`);
      } else {
        console.error(`Error in TeamEventBridge for '${this.sub_team_node_name}': ${error}`);
      }
    } finally {
      console.debug(`TeamEventBridge task for '${this.sub_team_node_name}' is finishing.`);
    }
  }

  async cancel(): Promise<void> {
    console.info(`Cancelling TeamEventBridge for '${this.sub_team_node_name}'.`);
    this.cancelled = true;
    await this.stream.close();
    await this._task;
    console.info(`TeamEventBridge for '${this.sub_team_node_name}' cancelled successfully.`);
  }
}
