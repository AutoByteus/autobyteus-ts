import { Singleton } from '../../utils/singleton.js';
import { ProcessorOption } from '../processor_option.js';
import { ToolInvocationPreprocessorDefinition } from './processor_definition.js';

export class ToolInvocationPreprocessorRegistry extends Singleton {
  private definitions: Map<string, ToolInvocationPreprocessorDefinition> = new Map();

  constructor() {
    super();
    const existing = (ToolInvocationPreprocessorRegistry as any)
      .instance as ToolInvocationPreprocessorRegistry | undefined;
    if (existing) {
      return existing;
    }
    (ToolInvocationPreprocessorRegistry as any).instance = this;
  }

  register_preprocessor(definition: ToolInvocationPreprocessorDefinition): void {
    if (!(definition instanceof ToolInvocationPreprocessorDefinition)) {
      throw new TypeError(
        `Expected ToolInvocationPreprocessorDefinition, got ${typeof definition}.`
      );
    }

    const name = definition.name;
    if (this.definitions.has(name)) {
      console.warn(`Overwriting existing tool invocation preprocessor definition '${name}'.`);
    }
    this.definitions.set(name, definition);
    console.info(`Tool invocation preprocessor definition '${name}' registered.`);
  }

  get_preprocessor_definition(name: string): ToolInvocationPreprocessorDefinition | undefined {
    if (typeof name !== 'string') {
      return undefined;
    }
    return this.definitions.get(name);
  }

  get_preprocessor(name: string): any | undefined {
    const definition = this.get_preprocessor_definition(name);
    if (!definition) {
      return undefined;
    }

    try {
      return new definition.processor_class();
    } catch (error) {
      console.error(
        `Failed to instantiate tool invocation preprocessor '${name}': ${error}`
      );
      return undefined;
    }
  }

  list_preprocessor_names(): string[] {
    return Array.from(this.definitions.keys());
  }

  // Backwards-compatible alias
  get_processor(name: string): any | undefined {
    return this.get_preprocessor(name);
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

  get_all_definitions(): Record<string, ToolInvocationPreprocessorDefinition> {
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

export const defaultToolInvocationPreprocessorRegistry = ToolInvocationPreprocessorRegistry.getInstance();
