import { LifecycleEvent } from './events.js';

export class BaseLifecycleEventProcessor {
  constructor() {
    if (new.target === BaseLifecycleEventProcessor) {
      throw new Error('BaseLifecycleEventProcessor cannot be instantiated directly.');
    }

    if (this.process === BaseLifecycleEventProcessor.prototype.process) {
      throw new Error("Subclasses must implement the 'process' method.");
    }

    const baseGetter = Object.getOwnPropertyDescriptor(BaseLifecycleEventProcessor.prototype, 'event')?.get;
    const derivedGetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this), 'event')?.get;
    if (!derivedGetter || derivedGetter === baseGetter) {
      throw new Error("Subclasses must implement the 'event' property.");
    }
  }

  static get_name(): string {
    return this.name;
  }

  static get_order(): number {
    return 500;
  }

  static is_mandatory(): boolean {
    return false;
  }

  get_name(): string {
    const ctor = this.constructor as typeof BaseLifecycleEventProcessor;
    return ctor.get_name();
  }

  get_order(): number {
    const ctor = this.constructor as typeof BaseLifecycleEventProcessor;
    return ctor.get_order();
  }

  is_mandatory(): boolean {
    const ctor = this.constructor as typeof BaseLifecycleEventProcessor;
    return ctor.is_mandatory();
  }

  get event(): LifecycleEvent {
    throw new Error("Subclasses must implement the 'event' property.");
  }

  async process(_context: unknown, _event_data: Record<string, any>): Promise<void> {
    throw new Error("Subclasses must implement the 'process' method.");
  }

  toString(): string {
    try {
      return `<${this.constructor.name} event='${this.event}'>`;
    } catch {
      return `<${this.constructor.name} (unconfigured)>`;
    }
  }
}
