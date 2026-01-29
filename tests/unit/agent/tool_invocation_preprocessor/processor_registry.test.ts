import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BaseToolInvocationPreprocessor } from '../../../../src/agent/tool_invocation_preprocessor/base_preprocessor.js';
import { ToolInvocationPreprocessorDefinition } from '../../../../src/agent/tool_invocation_preprocessor/processor_definition.js';
import {
  ToolInvocationPreprocessorRegistry,
  defaultToolInvocationPreprocessorRegistry
} from '../../../../src/agent/tool_invocation_preprocessor/processor_registry.js';
import type { ToolInvocation } from '../../../../src/agent/tool_invocation.js';
import type { AgentContext } from '../../../../src/agent/context/agent_context.js';

class ProcA extends BaseToolInvocationPreprocessor {
  static get_name(): string {
    return 'ProcA';
  }

  static get_order(): number {
    return 100;
  }

  static is_mandatory(): boolean {
    return true;
  }

  async process(invocation: ToolInvocation, _context: AgentContext): Promise<ToolInvocation> {
    return invocation;
  }
}

class ProcB extends BaseToolInvocationPreprocessor {
  static get_name(): string {
    return 'ProcB';
  }

  static get_order(): number {
    return 200;
  }

  async process(invocation: ToolInvocation, _context: AgentContext): Promise<ToolInvocation> {
    return invocation;
  }
}

class ProcWithInitError extends BaseToolInvocationPreprocessor {
  static get_name(): string {
    return 'ProcWithInitError';
  }

  constructor() {
    super();
    throw new Error('Init failed');
  }

  async process(invocation: ToolInvocation, _context: AgentContext): Promise<ToolInvocation> {
    return invocation;
  }
}

describe('ToolInvocationPreprocessorRegistry', () => {
  let originalDefinitions: Record<string, ToolInvocationPreprocessorDefinition> = {};

  beforeEach(() => {
    originalDefinitions = defaultToolInvocationPreprocessorRegistry.get_all_definitions();
    defaultToolInvocationPreprocessorRegistry.clear();
  });

  afterEach(() => {
    defaultToolInvocationPreprocessorRegistry.clear();
    for (const definition of Object.values(originalDefinitions)) {
      defaultToolInvocationPreprocessorRegistry.register_preprocessor(definition);
    }
  });

  it('is a singleton', () => {
    const registry1 = defaultToolInvocationPreprocessorRegistry;
    const registry2 = new ToolInvocationPreprocessorRegistry();
    expect(registry1).toBe(registry2);
  });

  it('registers preprocessor definitions', () => {
    const definition = new ToolInvocationPreprocessorDefinition('ProcA', ProcA);
    defaultToolInvocationPreprocessorRegistry.register_preprocessor(definition);

    expect(defaultToolInvocationPreprocessorRegistry.get_preprocessor_definition('ProcA')).toBe(definition);
    expect(defaultToolInvocationPreprocessorRegistry.length()).toBe(1);
  });

  it('overwrites existing definitions', () => {
    const definition1 = new ToolInvocationPreprocessorDefinition('ProcOverwrite', ProcA);
    const definition2 = new ToolInvocationPreprocessorDefinition('ProcOverwrite', ProcB);

    defaultToolInvocationPreprocessorRegistry.register_preprocessor(definition1);
    defaultToolInvocationPreprocessorRegistry.register_preprocessor(definition2);

    expect(defaultToolInvocationPreprocessorRegistry.get_preprocessor_definition('ProcOverwrite')).toBe(definition2);
    expect(defaultToolInvocationPreprocessorRegistry.length()).toBe(1);
  });

  it('rejects invalid definition types', () => {
    expect(() => defaultToolInvocationPreprocessorRegistry.register_preprocessor({} as ToolInvocationPreprocessorDefinition)).toThrow(
      /Expected ToolInvocationPreprocessorDefinition/
    );
  });

  it('returns processor instances when available', () => {
    const definition = new ToolInvocationPreprocessorDefinition('ProcA', ProcA);
    defaultToolInvocationPreprocessorRegistry.register_preprocessor(definition);

    const instance = defaultToolInvocationPreprocessorRegistry.get_preprocessor('ProcA');
    expect(instance).toBeInstanceOf(ProcA);
  });

  it('returns undefined for missing processor', () => {
    expect(defaultToolInvocationPreprocessorRegistry.get_preprocessor('NonExistentProc')).toBeUndefined();
  });

  it('returns undefined when processor instantiation fails', () => {
    const definition = new ToolInvocationPreprocessorDefinition('ProcWithInitError', ProcWithInitError);
    defaultToolInvocationPreprocessorRegistry.register_preprocessor(definition);

    const instance = defaultToolInvocationPreprocessorRegistry.get_preprocessor('ProcWithInitError');
    expect(instance).toBeUndefined();
  });

  it('lists processor names', () => {
    const definitionA = new ToolInvocationPreprocessorDefinition('ProcA', ProcA);
    const definitionB = new ToolInvocationPreprocessorDefinition('ProcB', ProcB);
    defaultToolInvocationPreprocessorRegistry.register_preprocessor(definitionA);
    defaultToolInvocationPreprocessorRegistry.register_preprocessor(definitionB);

    const names = defaultToolInvocationPreprocessorRegistry.list_preprocessor_names().sort();
    expect(names).toEqual(['ProcA', 'ProcB']);
  });

  it('exposes get_processor alias', () => {
    const definition = new ToolInvocationPreprocessorDefinition('ProcA', ProcA);
    defaultToolInvocationPreprocessorRegistry.register_preprocessor(definition);

    const instance = defaultToolInvocationPreprocessorRegistry.get_processor('ProcA');
    expect(instance).toBeInstanceOf(ProcA);
  });

  it('returns ordered processor options', () => {
    const definitionA = new ToolInvocationPreprocessorDefinition('ProcA', ProcA);
    const definitionB = new ToolInvocationPreprocessorDefinition('ProcB', ProcB);
    defaultToolInvocationPreprocessorRegistry.register_preprocessor(definitionB);
    defaultToolInvocationPreprocessorRegistry.register_preprocessor(definitionA);

    const options = defaultToolInvocationPreprocessorRegistry.get_ordered_processor_options();
    expect(options.map((opt) => opt.name)).toEqual(['ProcA', 'ProcB']);
    expect(options[0].is_mandatory).toBe(true);
    expect(options[1].is_mandatory).toBe(false);
  });

  it('returns all definitions', () => {
    const definition = new ToolInvocationPreprocessorDefinition('ProcA', ProcA);
    defaultToolInvocationPreprocessorRegistry.register_preprocessor(definition);

    const defs = defaultToolInvocationPreprocessorRegistry.get_all_definitions();
    expect(Object.keys(defs)).toEqual(['ProcA']);
    expect(defs.ProcA).toBe(definition);
  });

  it('clears definitions', () => {
    const definition = new ToolInvocationPreprocessorDefinition('ProcA', ProcA);
    defaultToolInvocationPreprocessorRegistry.register_preprocessor(definition);
    expect(defaultToolInvocationPreprocessorRegistry.length()).toBe(1);

    defaultToolInvocationPreprocessorRegistry.clear();
    expect(defaultToolInvocationPreprocessorRegistry.length()).toBe(0);
    expect(defaultToolInvocationPreprocessorRegistry.get_preprocessor_definition('ProcA')).toBeUndefined();
  });

  it('supports contains and length helpers', () => {
    expect(defaultToolInvocationPreprocessorRegistry.length()).toBe(0);
    expect(defaultToolInvocationPreprocessorRegistry.contains('ProcA')).toBe(false);

    const definition = new ToolInvocationPreprocessorDefinition('ProcA', ProcA);
    defaultToolInvocationPreprocessorRegistry.register_preprocessor(definition);

    expect(defaultToolInvocationPreprocessorRegistry.length()).toBe(1);
    expect(defaultToolInvocationPreprocessorRegistry.contains('ProcA')).toBe(true);
    expect(defaultToolInvocationPreprocessorRegistry.contains('NonExistent')).toBe(false);
    expect(defaultToolInvocationPreprocessorRegistry.contains(123 as unknown as string)).toBe(false);
  });
});
