import { randomUUID } from 'node:crypto';

type NodeDefinition = { name: string } & Record<string, any>;

export class TeamNodeConfig {
  node_definition: NodeDefinition;
  dependencies: TeamNodeConfig[];
  node_id: string;

  constructor(options: { node_definition: NodeDefinition; dependencies?: TeamNodeConfig[] }) {
    this.node_definition = options.node_definition;
    this.dependencies = options.dependencies ?? [];
    this.node_id = `node_${randomUUID().replace(/-/g, '')}`;
    this.validate();
  }

  private validate(): void {
    if (!this.node_definition || typeof this.node_definition.name !== 'string' || !this.node_definition.name) {
      throw new TypeError("The 'node_definition' attribute must provide a non-empty name.");
    }

    if (!Array.isArray(this.dependencies) || this.dependencies.some((dep) => !(dep instanceof TeamNodeConfig))) {
      throw new TypeError("All items in 'dependencies' must be instances of TeamNodeConfig.");
    }
  }

  get name(): string {
    return this.node_definition.name;
  }

  get effective_config(): NodeDefinition {
    return this.node_definition;
  }

  get is_sub_team(): boolean {
    const node = this.node_definition as Record<string, any> | null;
    return Boolean(node && Array.isArray(node.nodes) && node.coordinator_node);
  }

  equals(other: unknown): boolean {
    if (other instanceof TeamNodeConfig) {
      return this.node_id === other.node_id;
    }
    return false;
  }
}
