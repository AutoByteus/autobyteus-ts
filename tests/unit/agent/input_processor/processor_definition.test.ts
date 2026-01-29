import { describe, it, expect } from 'vitest';
import { AgentUserInputMessageProcessorDefinition } from '../../../../src/agent/input_processor/processor_definition.js';
import { BaseAgentUserInputMessageProcessor } from '../../../../src/agent/input_processor/base_user_input_processor.js';
import type { AgentInputUserMessage } from '../../../../src/agent/message/agent_input_user_message.js';
import type { AgentContext } from '../../../../src/agent/context/agent_context.js';
import type { UserMessageReceivedEvent } from '../../../../src/agent/events/agent_events.js';

class ProcA extends BaseAgentUserInputMessageProcessor {
  async process(
    message: AgentInputUserMessage,
    _context: AgentContext,
    _event: UserMessageReceivedEvent
  ): Promise<AgentInputUserMessage> {
    return message;
  }
}

describe('AgentUserInputMessageProcessorDefinition', () => {
  it('stores name and processor class', () => {
    const definition = new AgentUserInputMessageProcessorDefinition('ProcA', ProcA);
    expect(definition.name).toBe('ProcA');
    expect(definition.processor_class).toBe(ProcA);
    expect(definition.toString()).toContain("name='ProcA'");
  });

  it('rejects invalid names', () => {
    expect(() => new AgentUserInputMessageProcessorDefinition('', ProcA)).toThrow(
      /name must be a non-empty string/i
    );
  });

  it('rejects invalid processor classes', () => {
    expect(() => new AgentUserInputMessageProcessorDefinition('ProcA', {} as any)).toThrow(
      /processor_class must be a class type/i
    );
  });
});
