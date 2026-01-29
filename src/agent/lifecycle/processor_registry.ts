import { Singleton } from '../../utils/singleton.js';
import { LifecycleEventProcessorDefinition } from './processor_definition.js';
import type { BaseLifecycleEventProcessor } from './base_processor.js';
import { ProcessorOption } from '../processor_option.js';

export class LifecycleEventProcessorRegistry extends Singleton {
  private definitions: Map<string, LifecycleEventProcessorDefinition> = new Map();

  constructor() {
    super();
    const existing = (LifecycleEventProcessorRegistry as any).instance as LifecycleEventProcessorRegistry | undefined;
    if (existing) {
      return existing;
    }
    (LifecycleEventProcessorRegistry as any).instance = this;
  }

  register_processor(definition: LifecycleEventProcessorDefinition): void {
    if (!(definition instanceof LifecycleEventProcessorDefinition)) {
      throw new Error(`Expected LifecycleEventProcessorDefinition instance, got ${typeof definition}.`);
    }

    const name = definition.name;
    if (this.definitions.has(name)) {
      console.warn(`Overwriting existing lifecycle event processor definition for name: '${name}'.`);
    }

    this.definitions.set(name, definition);
  }

  get_processor_definition(name: string): LifecycleEventProcessorDefinition | undefined {
    if (typeof name !== 'string') {
      console.warn(`Attempted to retrieve lifecycle event processor definition with non-string name: ${typeof name}.`);
      return undefined;
    }

    const definition = this.definitions.get(name);
    if (!definition) {
      console.debug?.(`Lifecycle event processor definition with name '${name}' not found in registry.`);
    }
    return definition;
  }

  get_processor(name: string): BaseLifecycleEventProcessor | undefined {
    const definition = this.get_processor_definition(name);
    if (!definition) {
      return undefined;
    }

    try {
      return new definition.processor_class();
    } catch (error) {
      console.error(`Failed to instantiate lifecycle event processor '${name}': ${error}`);
      return undefined;
    }
  }

  list_processor_names(): string[] {
    return Array.from(this.definitions.keys());
  }

  get_ordered_processor_options(): ProcessorOption[] {
    const definitions = Array.from(this.definitions.values());
    const sorted = definitions.sort((a, b) => a.processor_class.get_order() - b.processor_class.get_order());
    return sorted.map((definition) => new ProcessorOption(definition.name, definition.processor_class.is_mandatory()));
  }

  get_all_definitions(): Record<string, LifecycleEventProcessorDefinition> {
    return Object.fromEntries(this.definitions.entries());
  }

  clear(): void {
    this.definitions.clear();
  }

  get length(): number {
    return this.definitions.size;
  }

  has(name: string): boolean {
    return typeof name === 'string' ? this.definitions.has(name) : false;
  }
}

export const defaultLifecycleEventProcessorRegistry = new LifecycleEventProcessorRegistry();
