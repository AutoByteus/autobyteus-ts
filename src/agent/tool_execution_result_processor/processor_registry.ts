import { Singleton } from '../../utils/singleton.js';
import { ProcessorOption } from '../processor_option.js';
import { ToolExecutionResultProcessorDefinition } from './processor_definition.js';

export class ToolExecutionResultProcessorRegistry extends Singleton {
  private definitions: Map<string, ToolExecutionResultProcessorDefinition> = new Map();

  constructor() {
    super();
    const existing = (ToolExecutionResultProcessorRegistry as any)
      .instance as ToolExecutionResultProcessorRegistry | undefined;
    if (existing) {
      return existing;
    }
    (ToolExecutionResultProcessorRegistry as any).instance = this;
  }

  register_processor(definition: ToolExecutionResultProcessorDefinition): void {
    if (!(definition instanceof ToolExecutionResultProcessorDefinition)) {
      throw new TypeError(
        `Expected ToolExecutionResultProcessorDefinition instance, got ${typeof definition}.`
      );
    }

    const name = definition.name;
    if (this.definitions.has(name)) {
      console.warn(`Overwriting existing tool execution result processor definition for name: '${name}'.`);
    }

    this.definitions.set(name, definition);
    console.info(`Tool execution result processor definition '${name}' registered successfully.`);
  }

  get_processor_definition(name: string): ToolExecutionResultProcessorDefinition | undefined {
    if (typeof name !== 'string') {
      return undefined;
    }
    return this.definitions.get(name);
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
        `Failed to instantiate tool execution result processor '${name}': ${error}`
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

  get_all_definitions(): Record<string, ToolExecutionResultProcessorDefinition> {
    return Object.fromEntries(this.definitions.entries());
  }

  clear(): void {
    this.definitions.clear();
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

export const defaultToolExecutionResultProcessorRegistry = ToolExecutionResultProcessorRegistry.getInstance();
