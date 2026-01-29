import { AgentEventStream } from '../../agent/streaming/streams/agent_event_stream.js';
import type { AgentTeamExternalEventNotifier } from './agent_team_event_notifier.js';

type AgentLike = { agent_id: string } | Record<string, any>;

type BridgeOptions = { stream?: AgentEventStream };

const resolveOptions = (loopOrOptions?: unknown, maybeOptions?: BridgeOptions): BridgeOptions | undefined => {
  if (loopOrOptions && typeof loopOrOptions === 'object' && 'stream' in (loopOrOptions as BridgeOptions)) {
    return loopOrOptions as BridgeOptions;
  }
  return maybeOptions;
};

export class AgentEventBridge {
  private agent_name: string;
  private notifier: AgentTeamExternalEventNotifier;
  private stream: AgentEventStream;
  private cancelled = false;
  _task: Promise<void>;

  constructor(
    agent: AgentLike,
    agent_name: string,
    notifier: AgentTeamExternalEventNotifier,
    loopOrOptions?: unknown,
    maybeOptions?: BridgeOptions
  ) {
    this.agent_name = agent_name;
    this.notifier = notifier;

    const options = resolveOptions(loopOrOptions, maybeOptions);
    this.stream = options?.stream ?? new AgentEventStream(agent as any);

    this._task = this.run();
    console.info(`AgentEventBridge created and task started for agent '${agent_name}'.`);
  }

  private async run(): Promise<void> {
    try {
      for await (const event of this.stream.all_events()) {
        if (this.cancelled) {
          break;
        }
        this.notifier.publish_agent_event(this.agent_name, event);
      }
    } catch (error) {
      if (this.cancelled) {
        console.info(`AgentEventBridge task for '${this.agent_name}' was cancelled.`);
      } else {
        console.error(`Error in AgentEventBridge for '${this.agent_name}': ${error}`);
      }
    } finally {
      console.debug(`AgentEventBridge task for '${this.agent_name}' is finishing.`);
    }
  }

  async cancel(): Promise<void> {
    console.info(`Cancelling AgentEventBridge for '${this.agent_name}'.`);
    this.cancelled = true;
    await this.stream.close();
    await this._task;
    console.info(`AgentEventBridge for '${this.agent_name}' cancelled successfully.`);
  }
}
