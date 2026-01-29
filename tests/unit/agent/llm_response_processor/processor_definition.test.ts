import { describe, it, expect } from 'vitest';
import { LLMResponseProcessorDefinition } from '../../../../src/agent/llm_response_processor/processor_definition.js';
import { BaseLLMResponseProcessor } from '../../../../src/agent/llm_response_processor/base_processor.js';
import type { AgentContext } from '../../../../src/agent/context/agent_context.js';
import type { LLMCompleteResponseReceivedEvent } from '../../../../src/agent/events/agent_events.js';
import type { CompleteResponse } from '../../../../src/llm/utils/response_types.js';

class ProcA extends BaseLLMResponseProcessor {
  async process_response(
    _response: CompleteResponse,
    _context: AgentContext,
    _event: LLMCompleteResponseReceivedEvent
  ): Promise<boolean> {
    return true;
  }
}

describe('LLMResponseProcessorDefinition', () => {
  it('stores name and processor class', () => {
    const definition = new LLMResponseProcessorDefinition('ProcA', ProcA);
    expect(definition.name).toBe('ProcA');
    expect(definition.processor_class).toBe(ProcA);
    expect(definition.toString()).toContain("name='ProcA'");
  });

  it('rejects invalid names', () => {
    expect(() => new LLMResponseProcessorDefinition('', ProcA)).toThrow(
      /name must be a non-empty string/i
    );
  });

  it('rejects invalid processor classes', () => {
    expect(() => new LLMResponseProcessorDefinition('ProcA', {} as any)).toThrow(
      /processor_class must be a class type/i
    );
  });
});
