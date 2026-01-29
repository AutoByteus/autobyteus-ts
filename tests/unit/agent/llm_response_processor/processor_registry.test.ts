import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BaseLLMResponseProcessor } from '../../../../src/agent/llm_response_processor/base_processor.js';
import { LLMResponseProcessorDefinition } from '../../../../src/agent/llm_response_processor/processor_definition.js';
import {
  LLMResponseProcessorRegistry,
  defaultLlmResponseProcessorRegistry
} from '../../../../src/agent/llm_response_processor/processor_registry.js';
import type { AgentContext } from '../../../../src/agent/context/agent_context.js';
import type { LLMCompleteResponseReceivedEvent } from '../../../../src/agent/events/agent_events.js';
import type { CompleteResponse } from '../../../../src/llm/utils/response_types.js';

class ProcA extends BaseLLMResponseProcessor {
  static get_name(): string {
    return 'ProcA';
  }

  static get_order(): number {
    return 100;
  }

  static is_mandatory(): boolean {
    return true;
  }

  async process_response(
    _response: CompleteResponse,
    _context: AgentContext,
    _event: LLMCompleteResponseReceivedEvent
  ): Promise<boolean> {
    return true;
  }
}

class ProcB extends BaseLLMResponseProcessor {
  static get_name(): string {
    return 'ProcB';
  }

  static get_order(): number {
    return 200;
  }

  async process_response(
    _response: CompleteResponse,
    _context: AgentContext,
    _event: LLMCompleteResponseReceivedEvent
  ): Promise<boolean> {
    return true;
  }
}

class ProcWithInitError extends BaseLLMResponseProcessor {
  static get_name(): string {
    return 'ProcWithInitError';
  }

  constructor() {
    super();
    throw new Error('Init failed');
  }

  async process_response(
    _response: CompleteResponse,
    _context: AgentContext,
    _event: LLMCompleteResponseReceivedEvent
  ): Promise<boolean> {
    return false;
  }
}

describe('LLMResponseProcessorRegistry', () => {
  let originalDefinitions: Record<string, LLMResponseProcessorDefinition> = {};

  beforeEach(() => {
    originalDefinitions = defaultLlmResponseProcessorRegistry.get_all_definitions();
    defaultLlmResponseProcessorRegistry.clear();
  });

  afterEach(() => {
    defaultLlmResponseProcessorRegistry.clear();
    for (const definition of Object.values(originalDefinitions)) {
      defaultLlmResponseProcessorRegistry.register_processor(definition);
    }
  });

  it('is a singleton', () => {
    const registry1 = defaultLlmResponseProcessorRegistry;
    const registry2 = new LLMResponseProcessorRegistry();
    expect(registry1).toBe(registry2);
  });

  it('registers processor definitions', () => {
    const definition = new LLMResponseProcessorDefinition('ProcA', ProcA);
    defaultLlmResponseProcessorRegistry.register_processor(definition);

    expect(defaultLlmResponseProcessorRegistry.get_processor_definition('ProcA')).toBe(definition);
    expect(defaultLlmResponseProcessorRegistry.length()).toBe(1);
  });

  it('overwrites existing definitions', () => {
    const definition1 = new LLMResponseProcessorDefinition('ProcOverwrite', ProcA);
    const definition2 = new LLMResponseProcessorDefinition('ProcOverwrite', ProcB);

    defaultLlmResponseProcessorRegistry.register_processor(definition1);
    defaultLlmResponseProcessorRegistry.register_processor(definition2);

    expect(defaultLlmResponseProcessorRegistry.get_processor_definition('ProcOverwrite')).toBe(definition2);
    expect(defaultLlmResponseProcessorRegistry.length()).toBe(1);
  });

  it('rejects invalid definition types', () => {
    expect(() => defaultLlmResponseProcessorRegistry.register_processor({} as LLMResponseProcessorDefinition)).toThrow(
      /Expected LLMResponseProcessorDefinition/
    );
  });

  it('returns undefined for invalid name lookups', () => {
    expect(defaultLlmResponseProcessorRegistry.get_processor_definition(null as unknown as string)).toBeUndefined();
    expect(defaultLlmResponseProcessorRegistry.get_processor_definition(123 as unknown as string)).toBeUndefined();
  });

  it('returns processor instances when available', () => {
    const definition = new LLMResponseProcessorDefinition('ProcA', ProcA);
    defaultLlmResponseProcessorRegistry.register_processor(definition);

    const instance = defaultLlmResponseProcessorRegistry.get_processor('ProcA');
    expect(instance).toBeInstanceOf(ProcA);
  });

  it('returns undefined for missing processor', () => {
    expect(defaultLlmResponseProcessorRegistry.get_processor('NonExistentProc')).toBeUndefined();
  });

  it('returns undefined when processor instantiation fails', () => {
    const definition = new LLMResponseProcessorDefinition('ProcWithInitError', ProcWithInitError);
    defaultLlmResponseProcessorRegistry.register_processor(definition);

    const instance = defaultLlmResponseProcessorRegistry.get_processor('ProcWithInitError');
    expect(instance).toBeUndefined();
  });

  it('lists processor names', () => {
    const definitionA = new LLMResponseProcessorDefinition('ProcA', ProcA);
    const definitionB = new LLMResponseProcessorDefinition('ProcB', ProcB);
    defaultLlmResponseProcessorRegistry.register_processor(definitionA);
    defaultLlmResponseProcessorRegistry.register_processor(definitionB);

    const names = defaultLlmResponseProcessorRegistry.list_processor_names().sort();
    expect(names).toEqual(['ProcA', 'ProcB']);
  });

  it('returns ordered processor options', () => {
    const definitionA = new LLMResponseProcessorDefinition('ProcA', ProcA);
    const definitionB = new LLMResponseProcessorDefinition('ProcB', ProcB);
    defaultLlmResponseProcessorRegistry.register_processor(definitionB);
    defaultLlmResponseProcessorRegistry.register_processor(definitionA);

    const options = defaultLlmResponseProcessorRegistry.get_ordered_processor_options();
    expect(options.map((opt) => opt.name)).toEqual(['ProcA', 'ProcB']);
    expect(options[0].is_mandatory).toBe(true);
    expect(options[1].is_mandatory).toBe(false);
  });

  it('returns all definitions', () => {
    const definition = new LLMResponseProcessorDefinition('ProcA', ProcA);
    defaultLlmResponseProcessorRegistry.register_processor(definition);

    const defs = defaultLlmResponseProcessorRegistry.get_all_definitions();
    expect(Object.keys(defs)).toEqual(['ProcA']);
    expect(defs.ProcA).toBe(definition);
  });

  it('clears definitions', () => {
    const definition = new LLMResponseProcessorDefinition('ProcA', ProcA);
    defaultLlmResponseProcessorRegistry.register_processor(definition);
    expect(defaultLlmResponseProcessorRegistry.length()).toBe(1);

    defaultLlmResponseProcessorRegistry.clear();
    expect(defaultLlmResponseProcessorRegistry.length()).toBe(0);
    expect(defaultLlmResponseProcessorRegistry.get_processor_definition('ProcA')).toBeUndefined();
  });

  it('supports contains and length helpers', () => {
    expect(defaultLlmResponseProcessorRegistry.length()).toBe(0);
    expect(defaultLlmResponseProcessorRegistry.contains('ProcA')).toBe(false);

    const definition = new LLMResponseProcessorDefinition('ProcA', ProcA);
    defaultLlmResponseProcessorRegistry.register_processor(definition);

    expect(defaultLlmResponseProcessorRegistry.length()).toBe(1);
    expect(defaultLlmResponseProcessorRegistry.contains('ProcA')).toBe(true);
    expect(defaultLlmResponseProcessorRegistry.contains('NonExistent')).toBe(false);
    expect(defaultLlmResponseProcessorRegistry.contains(123 as unknown as string)).toBe(false);
  });
});
