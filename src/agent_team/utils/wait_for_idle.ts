import { AgentTeamEventStream } from '../streaming/agent_team_event_stream.js';
import { AgentTeamStatus } from '../status/agent_team_status.js';
import { AgentTeamStreamEvent } from '../streaming/agent_team_stream_events.js';

export type AgentTeamLike = {
  team_id: string;
  get_current_status?: () => AgentTeamStatus;
};

const waitLoop = async (streamer: AgentTeamEventStream, team_id: string): Promise<void> => {
  for await (const event of streamer.all_events()) {
    if (event.event_source_type !== 'TEAM') {
      continue;
    }
    const data = event.data as { new_status?: AgentTeamStatus; error_message?: string } | undefined;
    if (data?.new_status === AgentTeamStatus.IDLE) {
      console.info(`Team '${team_id}' has become idle.`);
      return;
    }
    if (data?.new_status === AgentTeamStatus.ERROR) {
      const error_message =
        `Team '${team_id}' entered an error state while waiting for idle: ${data?.error_message ?? ''}`;
      console.error(error_message);
      throw new Error(error_message);
    }
  }
};

export async function wait_for_team_to_be_idle(team: AgentTeamLike, timeout: number = 60.0): Promise<void> {
  if (team.get_current_status && team.get_current_status() === AgentTeamStatus.IDLE) {
    return;
  }

  console.info(`Waiting for team '${team.team_id}' to become idle (timeout: ${timeout}s)...`);

  const streamer = new AgentTeamEventStream(team as any);
  try {
    const timeoutMs = Math.max(0, timeout * 1000);
    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout waiting for team to become idle')), timeoutMs)
    );
    await Promise.race([waitLoop(streamer, team.team_id), timeoutPromise]);
  } finally {
    await streamer.close();
  }
}
