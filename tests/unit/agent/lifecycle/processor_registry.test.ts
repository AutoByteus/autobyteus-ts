import { describe, it, expect, beforeEach } from 'vitest';
import {
  LifecycleEventProcessorRegistry,
  defaultLifecycleEventProcessorRegistry
} from '../../../../src/agent/lifecycle/processor_registry.js';
import { LifecycleEventProcessorDefinition } from '../../../../src/agent/lifecycle/processor_definition.js';
import { BaseLifecycleEventProcessor } from '../../../../src/agent/lifecycle/base_processor.js';
import { LifecycleEvent } from '../../../../src/agent/lifecycle/events.js';

class TestProcessorA extends BaseLifecycleEventProcessor {
  static get_order(): number {
    return 200;
  }

  get event(): LifecycleEvent {
    return LifecycleEvent.AGENT_READY;
  }

  async process(): Promise<void> {
    return;
  }
}

class TestProcessorB extends BaseLifecycleEventProcessor {
  static get_order(): number {
    return 100;
  }

  static is_mandatory(): boolean {
    return true;
  }

  get event(): LifecycleEvent {
    return LifecycleEvent.BEFORE_LLM_CALL;
  }

  async process(): Promise<void> {
    return;
  }
}

describe('LifecycleEventProcessorRegistry', () => {
  beforeEach(() => {
    (defaultLifecycleEventProcessorRegistry as LifecycleEventProcessorRegistry).clear();
  });

  it('registers and retrieves definitions', () => {
    const registry = new LifecycleEventProcessorRegistry();
    const definition = new LifecycleEventProcessorDefinition('proc_a', TestProcessorA);
    registry.register_processor(definition);
    expect(registry.get_processor_definition('proc_a')).toBe(definition);
  });

  it('creates processor instances', () => {
    const registry = new LifecycleEventProcessorRegistry();
    const definition = new LifecycleEventProcessorDefinition('proc_a', TestProcessorA);
    registry.register_processor(definition);
    const instance = registry.get_processor('proc_a');
    expect(instance).toBeInstanceOf(TestProcessorA);
  });

  it('lists processor names', () => {
    const registry = new LifecycleEventProcessorRegistry();
    registry.register_processor(new LifecycleEventProcessorDefinition('proc_a', TestProcessorA));
    registry.register_processor(new LifecycleEventProcessorDefinition('proc_b', TestProcessorB));
    const names = registry.list_processor_names();
    expect(new Set(names)).toEqual(new Set(['proc_a', 'proc_b']));
  });

  it('returns ordered processor options', () => {
    const registry = new LifecycleEventProcessorRegistry();
    registry.register_processor(new LifecycleEventProcessorDefinition('proc_a', TestProcessorA));
    registry.register_processor(new LifecycleEventProcessorDefinition('proc_b', TestProcessorB));

    const options = registry.get_ordered_processor_options();
    expect(options[0].name).toBe('proc_b');
    expect(options[0].is_mandatory).toBe(true);
    expect(options[1].name).toBe('proc_a');
  });

  it('returns undefined for unknown names', () => {
    const registry = new LifecycleEventProcessorRegistry();
    expect(registry.get_processor_definition('missing')).toBeUndefined();
  });
});
