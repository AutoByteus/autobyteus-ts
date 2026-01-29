export class AgentUserInputMessageProcessorDefinition {
  name: string;
  processor_class: new () => any;

  constructor(name: string, processor_class: new () => any) {
    if (!name || typeof name !== 'string') {
      throw new Error('Processor name must be a non-empty string.');
    }
    if (typeof processor_class !== 'function') {
      throw new Error('processor_class must be a class type.');
    }

    this.name = name;
    this.processor_class = processor_class;
  }

  toString(): string {
    return `<AgentUserInputMessageProcessorDefinition name='${this.name}', class='${this.processor_class.name}'>`;
  }
}
