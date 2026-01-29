import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BaseSystemPromptProcessor } from '../../../../src/agent/system_prompt_processor/base_processor.js';
import { SystemPromptProcessorDefinition } from '../../../../src/agent/system_prompt_processor/processor_definition.js';
import { SystemPromptProcessorRegistry, defaultSystemPromptProcessorRegistry } from '../../../../src/agent/system_prompt_processor/processor_registry.js';
import type { BaseTool } from '../../../../src/tools/base_tool.js';

type AgentContextLike = unknown;

class ProcA extends BaseSystemPromptProcessor {
  static get_name(): string { return 'ProcA'; }
  process(system_prompt: string, _tool_instances: Record<string, BaseTool>, _agent_id: string, _context: AgentContextLike): string { return system_prompt; }
}

class ProcB extends BaseSystemPromptProcessor {
  static get_name(): string { return 'ProcB'; }
  process(system_prompt: string, _tool_instances: Record<string, BaseTool>, _agent_id: string, _context: AgentContextLike): string { return system_prompt; }
}

class ProcWithInitError extends BaseSystemPromptProcessor {
  static get_name(): string { return 'ProcWithInitError'; }
  constructor() {
    super();
    throw new Error('Init failed');
  }
  process(system_prompt: string, _tool_instances: Record<string, BaseTool>, _agent_id: string, _context: AgentContextLike): string { return system_prompt; }
}

describe('SystemPromptProcessorRegistry', () => {
  let originalDefinitions: Record<string, SystemPromptProcessorDefinition> = {};

  beforeEach(() => {
    originalDefinitions = defaultSystemPromptProcessorRegistry.get_all_definitions();
    defaultSystemPromptProcessorRegistry.clear();
  });

  afterEach(() => {
    defaultSystemPromptProcessorRegistry.clear();
    for (const definition of Object.values(originalDefinitions)) {
      defaultSystemPromptProcessorRegistry.register_processor(definition);
    }
  });

  it('is a singleton', () => {
    const registry1 = defaultSystemPromptProcessorRegistry;
    const registry2 = new SystemPromptProcessorRegistry();
    expect(registry1).toBe(registry2);
  });

  it('registers processor definitions', () => {
    const definition = new SystemPromptProcessorDefinition('ProcA', ProcA);
    defaultSystemPromptProcessorRegistry.register_processor(definition);

    expect(defaultSystemPromptProcessorRegistry.get_processor_definition('ProcA')).toBe(definition);
    expect(defaultSystemPromptProcessorRegistry.length()).toBe(1);
  });

  it('overwrites existing definitions', () => {
    const definition1 = new SystemPromptProcessorDefinition('ProcOverwrite', ProcA);
    const definition2 = new SystemPromptProcessorDefinition('ProcOverwrite', ProcB);

    defaultSystemPromptProcessorRegistry.register_processor(definition1);
    defaultSystemPromptProcessorRegistry.register_processor(definition2);

    expect(defaultSystemPromptProcessorRegistry.get_processor_definition('ProcOverwrite')).toBe(definition2);
    expect(defaultSystemPromptProcessorRegistry.length()).toBe(1);
  });

  it('rejects invalid definition types', () => {
    expect(() => defaultSystemPromptProcessorRegistry.register_processor({} as SystemPromptProcessorDefinition)).toThrow(
      /Expected SystemPromptProcessorDefinition/
    );
  });

  it('handles invalid name lookups', () => {
    expect(defaultSystemPromptProcessorRegistry.get_processor_definition(null as unknown as string)).toBeUndefined();
    expect(defaultSystemPromptProcessorRegistry.get_processor_definition(123 as unknown as string)).toBeUndefined();
  });

  it('returns processor instances when available', () => {
    const definition = new SystemPromptProcessorDefinition('ProcA', ProcA);
    defaultSystemPromptProcessorRegistry.register_processor(definition);

    const instance = defaultSystemPromptProcessorRegistry.get_processor('ProcA');
    expect(instance).toBeInstanceOf(ProcA);
  });

  it('returns undefined for missing processor', () => {
    expect(defaultSystemPromptProcessorRegistry.get_processor('NonExistentProc')).toBeUndefined();
  });

  it('returns undefined when processor instantiation fails', () => {
    const definition = new SystemPromptProcessorDefinition('ProcWithInitError', ProcWithInitError);
    defaultSystemPromptProcessorRegistry.register_processor(definition);

    const instance = defaultSystemPromptProcessorRegistry.get_processor('ProcWithInitError');
    expect(instance).toBeUndefined();
  });

  it('lists processor names', () => {
    const definitionA = new SystemPromptProcessorDefinition('ProcA', ProcA);
    const definitionB = new SystemPromptProcessorDefinition('ProcB', ProcB);
    defaultSystemPromptProcessorRegistry.register_processor(definitionA);
    defaultSystemPromptProcessorRegistry.register_processor(definitionB);

    const names = defaultSystemPromptProcessorRegistry.list_processor_names().sort();
    expect(names).toEqual(['ProcA', 'ProcB']);
  });

  it('returns all definitions', () => {
    const definition = new SystemPromptProcessorDefinition('ProcA', ProcA);
    defaultSystemPromptProcessorRegistry.register_processor(definition);

    const defs = defaultSystemPromptProcessorRegistry.get_all_definitions();
    expect(Object.keys(defs)).toEqual(['ProcA']);
    expect(defs.ProcA).toBe(definition);
  });

  it('clears definitions', () => {
    const definition = new SystemPromptProcessorDefinition('ProcA', ProcA);
    defaultSystemPromptProcessorRegistry.register_processor(definition);
    expect(defaultSystemPromptProcessorRegistry.length()).toBe(1);

    defaultSystemPromptProcessorRegistry.clear();
    expect(defaultSystemPromptProcessorRegistry.length()).toBe(0);
    expect(defaultSystemPromptProcessorRegistry.get_processor_definition('ProcA')).toBeUndefined();
  });

  it('supports contains and length helpers', () => {
    expect(defaultSystemPromptProcessorRegistry.length()).toBe(0);
    expect(defaultSystemPromptProcessorRegistry.contains('ProcA')).toBe(false);

    const definition = new SystemPromptProcessorDefinition('ProcA', ProcA);
    defaultSystemPromptProcessorRegistry.register_processor(definition);

    expect(defaultSystemPromptProcessorRegistry.length()).toBe(1);
    expect(defaultSystemPromptProcessorRegistry.contains('ProcA')).toBe(true);
    expect(defaultSystemPromptProcessorRegistry.contains('NonExistent')).toBe(false);
    expect(defaultSystemPromptProcessorRegistry.contains(123 as unknown as string)).toBe(false);
  });
});
