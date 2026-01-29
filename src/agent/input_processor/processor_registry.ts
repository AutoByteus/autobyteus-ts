import { Singleton } from '../../utils/singleton.js';
import { ProcessorOption } from '../processor_option.js';
import { AgentUserInputMessageProcessorDefinition } from './processor_definition.js';

export class AgentUserInputMessageProcessorRegistry extends Singleton {
  private definitions: Map<string, AgentUserInputMessageProcessorDefinition> = new Map();

  constructor() {
    super();
    const existing = (AgentUserInputMessageProcessorRegistry as any)
      .instance as AgentUserInputMessageProcessorRegistry | undefined;
    if (existing) {
      return existing;
    }
    (AgentUserInputMessageProcessorRegistry as any).instance = this;
  }

  register_processor(definition: AgentUserInputMessageProcessorDefinition): void {
    if (!(definition instanceof AgentUserInputMessageProcessorDefinition)) {
      throw new TypeError(
        `Expected AgentUserInputMessageProcessorDefinition instance, got ${typeof definition}.`
      );
    }

    const processor_name = definition.name;
    if (this.definitions.has(processor_name)) {
      console.warn(`Overwriting existing input processor definition for name: '${processor_name}'.`);
    }

    this.definitions.set(processor_name, definition);
    console.info(
      `Input processor definition '${processor_name}' (class: '${definition.processor_class.name}') registered successfully.`
    );
  }

  get_processor_definition(name: string): AgentUserInputMessageProcessorDefinition | undefined {
    if (typeof name !== 'string') {
      console.warn(
        `Attempted to retrieve input processor definition with non-string name: ${typeof name}.`
      );
      return undefined;
    }

    const definition = this.definitions.get(name);
    if (!definition) {
      console.debug(`Input processor definition with name '${name}' not found in registry.`);
    }
    return definition;
  }

  get_processor(name: string): any | undefined {
    const definition = this.get_processor_definition(name);
    if (!definition) {
      return undefined;
    }

    try {
      return new definition.processor_class();
    } catch (error) {
      console.error(
        `Failed to instantiate input processor '${name}' from class '${definition.processor_class.name}': ${error}`
      );
      return undefined;
    }
  }

  list_processor_names(): string[] {
    return Array.from(this.definitions.keys());
  }

  get_ordered_processor_options(): ProcessorOption[] {
    const definitions = Array.from(this.definitions.values());
    const sortedDefinitions = definitions.sort((a, b) => {
      const orderA =
        typeof (a.processor_class as any).get_order === 'function'
          ? (a.processor_class as any).get_order()
          : 500;
      const orderB =
        typeof (b.processor_class as any).get_order === 'function'
          ? (b.processor_class as any).get_order()
          : 500;
      return orderA - orderB;
    });

    return sortedDefinitions.map(
      (definition) =>
        new ProcessorOption(
          definition.name,
          typeof (definition.processor_class as any).is_mandatory === 'function'
            ? (definition.processor_class as any).is_mandatory()
            : false
        )
    );
  }

  get_all_definitions(): Record<string, AgentUserInputMessageProcessorDefinition> {
    return Object.fromEntries(this.definitions.entries());
  }

  clear(): void {
    const count = this.definitions.size;
    this.definitions.clear();
    console.info(`Cleared ${count} definitions from the AgentUserInputMessageProcessorRegistry.`);
  }

  length(): number {
    return this.definitions.size;
  }

  contains(name: string): boolean {
    if (typeof name !== 'string') {
      return false;
    }
    return this.definitions.has(name);
  }
}

export const defaultInputProcessorRegistry = AgentUserInputMessageProcessorRegistry.getInstance();
