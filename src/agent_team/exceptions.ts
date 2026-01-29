export class TeamNodeNotFoundException extends Error {
  node_name: string;
  team_id: string;

  constructor(node_name: string, team_id: string) {
    super(`Node '${node_name}' not found in agent team '${team_id}'.`);
    this.node_name = node_name;
    this.team_id = team_id;
  }
}
