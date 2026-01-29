import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BaseToolExecutionResultProcessor } from '../../../../src/agent/tool_execution_result_processor/base_processor.js';
import { ToolExecutionResultProcessorDefinition } from '../../../../src/agent/tool_execution_result_processor/processor_definition.js';
import {
  ToolExecutionResultProcessorRegistry,
  defaultToolExecutionResultProcessorRegistry
} from '../../../../src/agent/tool_execution_result_processor/processor_registry.js';
import type { ToolResultEvent } from '../../../../src/agent/events/agent_events.js';
import type { AgentContext } from '../../../../src/agent/context/agent_context.js';

class ProcA extends BaseToolExecutionResultProcessor {
  static get_name(): string {
    return 'ProcA';
  }

  static get_order(): number {
    return 100;
  }

  static is_mandatory(): boolean {
    return true;
  }

  async process(event: ToolResultEvent, _context: AgentContext): Promise<ToolResultEvent> {
    return event;
  }
}

class ProcB extends BaseToolExecutionResultProcessor {
  static get_name(): string {
    return 'ProcB';
  }

  static get_order(): number {
    return 200;
  }

  async process(event: ToolResultEvent, _context: AgentContext): Promise<ToolResultEvent> {
    return event;
  }
}

class ProcWithInitError extends BaseToolExecutionResultProcessor {
  static get_name(): string {
    return 'ProcWithInitError';
  }

  constructor() {
    super();
    throw new Error('Init failed');
  }

  async process(event: ToolResultEvent, _context: AgentContext): Promise<ToolResultEvent> {
    return event;
  }
}

describe('ToolExecutionResultProcessorRegistry', () => {
  let originalDefinitions: Record<string, ToolExecutionResultProcessorDefinition> = {};

  beforeEach(() => {
    originalDefinitions = defaultToolExecutionResultProcessorRegistry.get_all_definitions();
    defaultToolExecutionResultProcessorRegistry.clear();
  });

  afterEach(() => {
    defaultToolExecutionResultProcessorRegistry.clear();
    for (const definition of Object.values(originalDefinitions)) {
      defaultToolExecutionResultProcessorRegistry.register_processor(definition);
    }
  });

  it('is a singleton', () => {
    const registry1 = defaultToolExecutionResultProcessorRegistry;
    const registry2 = new ToolExecutionResultProcessorRegistry();
    expect(registry1).toBe(registry2);
  });

  it('registers processor definitions', () => {
    const definition = new ToolExecutionResultProcessorDefinition('ProcA', ProcA);
    defaultToolExecutionResultProcessorRegistry.register_processor(definition);

    expect(defaultToolExecutionResultProcessorRegistry.get_processor_definition('ProcA')).toBe(definition);
    expect(defaultToolExecutionResultProcessorRegistry.length()).toBe(1);
  });

  it('overwrites existing definitions', () => {
    const definition1 = new ToolExecutionResultProcessorDefinition('ProcOverwrite', ProcA);
    const definition2 = new ToolExecutionResultProcessorDefinition('ProcOverwrite', ProcB);

    defaultToolExecutionResultProcessorRegistry.register_processor(definition1);
    defaultToolExecutionResultProcessorRegistry.register_processor(definition2);

    expect(defaultToolExecutionResultProcessorRegistry.get_processor_definition('ProcOverwrite')).toBe(definition2);
    expect(defaultToolExecutionResultProcessorRegistry.length()).toBe(1);
  });

  it('rejects invalid definition types', () => {
    expect(() => defaultToolExecutionResultProcessorRegistry.register_processor({} as ToolExecutionResultProcessorDefinition)).toThrow(
      /Expected ToolExecutionResultProcessorDefinition/
    );
  });

  it('returns processor instances when available', () => {
    const definition = new ToolExecutionResultProcessorDefinition('ProcA', ProcA);
    defaultToolExecutionResultProcessorRegistry.register_processor(definition);

    const instance = defaultToolExecutionResultProcessorRegistry.get_processor('ProcA');
    expect(instance).toBeInstanceOf(ProcA);
  });

  it('returns undefined for missing processor', () => {
    expect(defaultToolExecutionResultProcessorRegistry.get_processor('NonExistentProc')).toBeUndefined();
  });

  it('returns undefined when processor instantiation fails', () => {
    const definition = new ToolExecutionResultProcessorDefinition('ProcWithInitError', ProcWithInitError);
    defaultToolExecutionResultProcessorRegistry.register_processor(definition);

    const instance = defaultToolExecutionResultProcessorRegistry.get_processor('ProcWithInitError');
    expect(instance).toBeUndefined();
  });

  it('lists processor names', () => {
    const definitionA = new ToolExecutionResultProcessorDefinition('ProcA', ProcA);
    const definitionB = new ToolExecutionResultProcessorDefinition('ProcB', ProcB);
    defaultToolExecutionResultProcessorRegistry.register_processor(definitionA);
    defaultToolExecutionResultProcessorRegistry.register_processor(definitionB);

    const names = defaultToolExecutionResultProcessorRegistry.list_processor_names().sort();
    expect(names).toEqual(['ProcA', 'ProcB']);
  });

  it('returns ordered processor options', () => {
    const definitionA = new ToolExecutionResultProcessorDefinition('ProcA', ProcA);
    const definitionB = new ToolExecutionResultProcessorDefinition('ProcB', ProcB);
    defaultToolExecutionResultProcessorRegistry.register_processor(definitionB);
    defaultToolExecutionResultProcessorRegistry.register_processor(definitionA);

    const options = defaultToolExecutionResultProcessorRegistry.get_ordered_processor_options();
    expect(options.map((opt) => opt.name)).toEqual(['ProcA', 'ProcB']);
    expect(options[0].is_mandatory).toBe(true);
    expect(options[1].is_mandatory).toBe(false);
  });

  it('returns all definitions', () => {
    const definition = new ToolExecutionResultProcessorDefinition('ProcA', ProcA);
    defaultToolExecutionResultProcessorRegistry.register_processor(definition);

    const defs = defaultToolExecutionResultProcessorRegistry.get_all_definitions();
    expect(Object.keys(defs)).toEqual(['ProcA']);
    expect(defs.ProcA).toBe(definition);
  });

  it('clears definitions', () => {
    const definition = new ToolExecutionResultProcessorDefinition('ProcA', ProcA);
    defaultToolExecutionResultProcessorRegistry.register_processor(definition);
    expect(defaultToolExecutionResultProcessorRegistry.length()).toBe(1);

    defaultToolExecutionResultProcessorRegistry.clear();
    expect(defaultToolExecutionResultProcessorRegistry.length()).toBe(0);
    expect(defaultToolExecutionResultProcessorRegistry.get_processor_definition('ProcA')).toBeUndefined();
  });

  it('supports contains and length helpers', () => {
    expect(defaultToolExecutionResultProcessorRegistry.length()).toBe(0);
    expect(defaultToolExecutionResultProcessorRegistry.contains('ProcA')).toBe(false);

    const definition = new ToolExecutionResultProcessorDefinition('ProcA', ProcA);
    defaultToolExecutionResultProcessorRegistry.register_processor(definition);

    expect(defaultToolExecutionResultProcessorRegistry.length()).toBe(1);
    expect(defaultToolExecutionResultProcessorRegistry.contains('ProcA')).toBe(true);
    expect(defaultToolExecutionResultProcessorRegistry.contains('NonExistent')).toBe(false);
    expect(defaultToolExecutionResultProcessorRegistry.contains(123 as unknown as string)).toBe(false);
  });
});
