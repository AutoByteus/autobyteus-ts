export class AgentNotFoundException extends Error {
  agent_id: string;

  constructor(agent_id: string) {
    super(`Agent with id ${agent_id} not found. This is an invalid state.`);
    this.agent_id = agent_id;
    this.name = 'AgentNotFoundException';
  }
}
