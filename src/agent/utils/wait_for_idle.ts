import { Agent } from '../agent.js';
import { AgentEventStream } from '../streaming/streams/agent_event_stream.js';
import { AgentStatus } from '../status/status_enum.js';

const waitLoop = async (streamer: AgentEventStream, agent_id: string): Promise<void> => {
  for await (const status_update of streamer.stream_status_updates()) {
    if (status_update.new_status === AgentStatus.IDLE) {
      console.info(`Agent '${agent_id}' has become idle.`);
      return;
    }
    if (status_update.new_status === AgentStatus.ERROR) {
      const error_message =
        `Agent '${agent_id}' entered an error state while waiting for idle: ${status_update}`;
      console.error(error_message);
      throw new Error(error_message);
    }
  }
};

export async function wait_for_agent_to_be_idle(agent: Agent, timeout: number = 30.0): Promise<void> {
  if (!(agent instanceof Agent)) {
    throw new TypeError("The 'agent' argument must be an instance of the Agent class.");
  }

  const current_status = agent.get_current_status();
  if (AgentStatus.isTerminal(current_status)) {
    console.warn(
      `Agent '${agent.agent_id}' is already in a terminal state (${current_status}) and will not become idle.`
    );
    return;
  }

  if (current_status === AgentStatus.IDLE) {
    console.debug(`Agent '${agent.agent_id}' is already idle.`);
    return;
  }

  console.info(`Waiting for agent '${agent.agent_id}' to become idle (timeout: ${timeout}s)...`);

  const streamer = new AgentEventStream(agent);
  const timeoutMs = Math.max(0, timeout * 1000);
  const timeoutPromise = new Promise<void>((_resolve, reject) => {
    const handle = setTimeout(() => {
      clearTimeout(handle);
      reject(new Error(`Timed out waiting for agent '${agent.agent_id}' to become idle.`));
    }, timeoutMs);
  });

  try {
    await Promise.race([waitLoop(streamer, agent.agent_id), timeoutPromise]);
  } finally {
    await streamer.close();
  }
}
