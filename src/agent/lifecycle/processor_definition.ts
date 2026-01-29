import { BaseLifecycleEventProcessor } from './base_processor.js';

export class LifecycleEventProcessorDefinition {
  name: string;
  processor_class: typeof BaseLifecycleEventProcessor;

  constructor(name: string, processorClass: typeof BaseLifecycleEventProcessor) {
    if (!name || typeof name !== 'string') {
      throw new Error('Processor name must be a non-empty string.');
    }
    if (typeof processorClass !== 'function') {
      throw new Error('processor_class must be a class constructor.');
    }

    this.name = name;
    this.processor_class = processorClass;
  }

  toString(): string {
    return `<LifecycleEventProcessorDefinition name='${this.name}', class='${this.processor_class.name}'>`;
  }
}
