import { AgentTeam } from './agent_team.js';
import { AgentTeamConfig } from './context/agent_team_config.js';
import { TeamNodeConfig } from './context/team_node_config.js';
import { AgentConfig } from '../agent/context/agent_config.js';
import { AgentTeamFactory } from './factory/agent_team_factory.js';

export type NodeDefinition = AgentConfig | AgentTeamConfig;

export class AgentTeamBuilder {
  private _name: string;
  private _description: string;
  private _role: string | null | undefined;
  private _nodes: Map<NodeDefinition, NodeDefinition[]> = new Map();
  private _coordinator_config: AgentConfig | null = null;
  private _added_node_names: Set<string> = new Set();

  constructor(name: string, description: string, role?: string | null) {
    if (!name || typeof name !== 'string') {
      throw new Error('Agent team name must be a non-empty string.');
    }
    if (!description || typeof description !== 'string') {
      throw new Error('Agent team description must be a non-empty string.');
    }

    this._name = name;
    this._description = description;
    this._role = role;
    console.info(`AgentTeamBuilder initialized for team: '${this._name}'.`);
  }

  add_agent_node(agent_config: AgentConfig, dependencies?: NodeDefinition[]): AgentTeamBuilder {
    this._add_node_internal(agent_config, dependencies);
    return this;
  }

  add_sub_team_node(team_config: AgentTeamConfig, dependencies?: NodeDefinition[]): AgentTeamBuilder {
    this._add_node_internal(team_config, dependencies);
    return this;
  }

  private _add_node_internal(node_definition: NodeDefinition, dependencies?: NodeDefinition[]): void {
    if (!(node_definition instanceof AgentConfig || node_definition instanceof AgentTeamConfig)) {
      throw new TypeError('node_definition must be an instance of AgentConfig or AgentTeamConfig.');
    }

    const node_name = node_definition.name;
    if (this._added_node_names.has(node_name)) {
      throw new Error(
        `Duplicate node name '${node_name}' detected. All nodes in a team must have a unique name.`
      );
    }

    if (this._nodes.has(node_definition) || node_definition === this._coordinator_config) {
      throw new Error(
        `The exact same node definition object for '${node_name}' has already been added to the team.`
      );
    }

    if (dependencies && dependencies.length > 0) {
      for (const dep_config of dependencies) {
        if (!this._nodes.has(dep_config) && dep_config !== this._coordinator_config) {
          throw new Error(
            `Dependency node '${dep_config.name}' must be added to the builder before being used as a dependency.`
          );
        }
      }
    }

    this._nodes.set(node_definition, dependencies ?? []);
    this._added_node_names.add(node_name);

    const nodeType = node_definition instanceof AgentTeamConfig ? 'Sub-Team' : 'Agent';
    console.debug(
      `Added ${nodeType} node '${node_name}' to builder with ${(dependencies ?? []).length} dependencies.`
    );
  }

  set_coordinator(agent_config: AgentConfig): AgentTeamBuilder {
    if (this._coordinator_config) {
      throw new Error('A coordinator has already been set for this team.');
    }

    if (!(agent_config instanceof AgentConfig)) {
      throw new TypeError('Coordinator must be an instance of AgentConfig.');
    }

    const node_name = agent_config.name;
    if (this._added_node_names.has(node_name)) {
      throw new Error(
        `Duplicate node name '${node_name}' detected. The coordinator's name must also be unique within the team.`
      );
    }

    this._coordinator_config = agent_config;
    this._added_node_names.add(node_name);
    console.debug(`Set coordinator for team to '${agent_config.name}'.`);
    return this;
  }

  build(): AgentTeam {
    console.info('Building AgentTeam from builder...');
    if (!this._coordinator_config) {
      throw new Error('Cannot build team: A coordinator must be set.');
    }

    const node_map = new Map<NodeDefinition, TeamNodeConfig>();
    const all_definitions = Array.from(this._nodes.keys());
    if (!all_definitions.includes(this._coordinator_config)) {
      all_definitions.push(this._coordinator_config);
    }

    for (const definition of all_definitions) {
      node_map.set(definition, new TeamNodeConfig({ node_definition: definition }));
    }

    for (const [node_def, dep_defs] of this._nodes.entries()) {
      if (dep_defs && dep_defs.length > 0) {
        const current_node = node_map.get(node_def);
        if (!current_node) {
          continue;
        }
        const dependency_nodes = dep_defs.map((dep_def) => node_map.get(dep_def)).filter(Boolean) as TeamNodeConfig[];
        current_node.dependencies = dependency_nodes;
      }
    }

    const final_nodes = Array.from(node_map.values());
    const coordinator_node_instance = node_map.get(this._coordinator_config);
    if (!coordinator_node_instance) {
      throw new Error('Coordinator node configuration was not created.');
    }

    const team_config = new AgentTeamConfig({
      name: this._name,
      description: this._description,
      role: this._role ?? null,
      nodes: final_nodes,
      coordinator_node: coordinator_node_instance
    });

    console.info(
      `AgentTeamConfig created successfully. Name: '${team_config.name}'. Total nodes: ${final_nodes.length}. Coordinator: '${coordinator_node_instance.name}'.`
    );

    const factory = new AgentTeamFactory();
    return factory.create_team(team_config);
  }
}
