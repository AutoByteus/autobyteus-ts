import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BaseAgentUserInputMessageProcessor } from '../../../../src/agent/input_processor/base_user_input_processor.js';
import { AgentUserInputMessageProcessorDefinition } from '../../../../src/agent/input_processor/processor_definition.js';
import {
  AgentUserInputMessageProcessorRegistry,
  defaultInputProcessorRegistry
} from '../../../../src/agent/input_processor/processor_registry.js';
import type { AgentInputUserMessage } from '../../../../src/agent/message/agent_input_user_message.js';
import type { AgentContext } from '../../../../src/agent/context/agent_context.js';
import type { UserMessageReceivedEvent } from '../../../../src/agent/events/agent_events.js';

class ProcA extends BaseAgentUserInputMessageProcessor {
  static get_name(): string {
    return 'ProcA';
  }

  static get_order(): number {
    return 100;
  }

  static is_mandatory(): boolean {
    return true;
  }

  async process(
    message: AgentInputUserMessage,
    _context: AgentContext,
    _event: UserMessageReceivedEvent
  ): Promise<AgentInputUserMessage> {
    return message;
  }
}

class ProcB extends BaseAgentUserInputMessageProcessor {
  static get_name(): string {
    return 'ProcB';
  }

  static get_order(): number {
    return 200;
  }

  async process(
    message: AgentInputUserMessage,
    _context: AgentContext,
    _event: UserMessageReceivedEvent
  ): Promise<AgentInputUserMessage> {
    return message;
  }
}

class ProcWithInitError extends BaseAgentUserInputMessageProcessor {
  static get_name(): string {
    return 'ProcWithInitError';
  }

  constructor() {
    super();
    throw new Error('Init failed');
  }

  async process(
    message: AgentInputUserMessage,
    _context: AgentContext,
    _event: UserMessageReceivedEvent
  ): Promise<AgentInputUserMessage> {
    return message;
  }
}

describe('AgentUserInputMessageProcessorRegistry', () => {
  let originalDefinitions: Record<string, AgentUserInputMessageProcessorDefinition> = {};

  beforeEach(() => {
    originalDefinitions = defaultInputProcessorRegistry.get_all_definitions();
    defaultInputProcessorRegistry.clear();
  });

  afterEach(() => {
    defaultInputProcessorRegistry.clear();
    for (const definition of Object.values(originalDefinitions)) {
      defaultInputProcessorRegistry.register_processor(definition);
    }
  });

  it('is a singleton', () => {
    const registry1 = defaultInputProcessorRegistry;
    const registry2 = new AgentUserInputMessageProcessorRegistry();
    expect(registry1).toBe(registry2);
  });

  it('registers processor definitions', () => {
    const definition = new AgentUserInputMessageProcessorDefinition('ProcA', ProcA);
    defaultInputProcessorRegistry.register_processor(definition);

    expect(defaultInputProcessorRegistry.get_processor_definition('ProcA')).toBe(definition);
    expect(defaultInputProcessorRegistry.length()).toBe(1);
  });

  it('overwrites existing definitions', () => {
    const definition1 = new AgentUserInputMessageProcessorDefinition('ProcOverwrite', ProcA);
    const definition2 = new AgentUserInputMessageProcessorDefinition('ProcOverwrite', ProcB);

    defaultInputProcessorRegistry.register_processor(definition1);
    defaultInputProcessorRegistry.register_processor(definition2);

    expect(defaultInputProcessorRegistry.get_processor_definition('ProcOverwrite')).toBe(definition2);
    expect(defaultInputProcessorRegistry.length()).toBe(1);
  });

  it('rejects invalid definition types', () => {
    expect(() => defaultInputProcessorRegistry.register_processor({} as AgentUserInputMessageProcessorDefinition)).toThrow(
      /Expected AgentUserInputMessageProcessorDefinition/
    );
  });

  it('handles invalid name lookups', () => {
    expect(defaultInputProcessorRegistry.get_processor_definition(null as unknown as string)).toBeUndefined();
    expect(defaultInputProcessorRegistry.get_processor_definition(123 as unknown as string)).toBeUndefined();
  });

  it('returns processor instances when available', () => {
    const definition = new AgentUserInputMessageProcessorDefinition('ProcA', ProcA);
    defaultInputProcessorRegistry.register_processor(definition);

    const instance = defaultInputProcessorRegistry.get_processor('ProcA');
    expect(instance).toBeInstanceOf(ProcA);
  });

  it('returns undefined for missing processor', () => {
    expect(defaultInputProcessorRegistry.get_processor('NonExistentProc')).toBeUndefined();
  });

  it('returns undefined when processor instantiation fails', () => {
    const definition = new AgentUserInputMessageProcessorDefinition('ProcWithInitError', ProcWithInitError);
    defaultInputProcessorRegistry.register_processor(definition);

    const instance = defaultInputProcessorRegistry.get_processor('ProcWithInitError');
    expect(instance).toBeUndefined();
  });

  it('lists processor names', () => {
    const definitionA = new AgentUserInputMessageProcessorDefinition('ProcA', ProcA);
    const definitionB = new AgentUserInputMessageProcessorDefinition('ProcB', ProcB);
    defaultInputProcessorRegistry.register_processor(definitionA);
    defaultInputProcessorRegistry.register_processor(definitionB);

    const names = defaultInputProcessorRegistry.list_processor_names().sort();
    expect(names).toEqual(['ProcA', 'ProcB']);
  });

  it('returns ordered processor options', () => {
    const definitionA = new AgentUserInputMessageProcessorDefinition('ProcA', ProcA);
    const definitionB = new AgentUserInputMessageProcessorDefinition('ProcB', ProcB);
    defaultInputProcessorRegistry.register_processor(definitionB);
    defaultInputProcessorRegistry.register_processor(definitionA);

    const options = defaultInputProcessorRegistry.get_ordered_processor_options();
    expect(options.map((opt) => opt.name)).toEqual(['ProcA', 'ProcB']);
    expect(options[0].is_mandatory).toBe(true);
    expect(options[1].is_mandatory).toBe(false);
  });

  it('returns all definitions', () => {
    const definition = new AgentUserInputMessageProcessorDefinition('ProcA', ProcA);
    defaultInputProcessorRegistry.register_processor(definition);

    const defs = defaultInputProcessorRegistry.get_all_definitions();
    expect(Object.keys(defs)).toEqual(['ProcA']);
    expect(defs.ProcA).toBe(definition);
  });

  it('clears definitions', () => {
    const definition = new AgentUserInputMessageProcessorDefinition('ProcA', ProcA);
    defaultInputProcessorRegistry.register_processor(definition);
    expect(defaultInputProcessorRegistry.length()).toBe(1);

    defaultInputProcessorRegistry.clear();
    expect(defaultInputProcessorRegistry.length()).toBe(0);
    expect(defaultInputProcessorRegistry.get_processor_definition('ProcA')).toBeUndefined();
  });

  it('supports contains and length helpers', () => {
    expect(defaultInputProcessorRegistry.length()).toBe(0);
    expect(defaultInputProcessorRegistry.contains('ProcA')).toBe(false);

    const definition = new AgentUserInputMessageProcessorDefinition('ProcA', ProcA);
    defaultInputProcessorRegistry.register_processor(definition);

    expect(defaultInputProcessorRegistry.length()).toBe(1);
    expect(defaultInputProcessorRegistry.contains('ProcA')).toBe(true);
    expect(defaultInputProcessorRegistry.contains('NonExistent')).toBe(false);
    expect(defaultInputProcessorRegistry.contains(123 as unknown as string)).toBe(false);
  });
});
