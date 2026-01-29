import { describe, it, expect } from 'vitest';
import { BaseLLMResponseProcessor } from '../../../../src/agent/llm_response_processor/base_processor.js';
import type { AgentContext } from '../../../../src/agent/context/agent_context.js';
import type { LLMCompleteResponseReceivedEvent } from '../../../../src/agent/events/agent_events.js';
import type { CompleteResponse } from '../../../../src/llm/utils/response_types.js';

class MyTestProcessor extends BaseLLMResponseProcessor {
  async process_response(
    response: CompleteResponse,
    _context: AgentContext,
    _event: LLMCompleteResponseReceivedEvent
  ): Promise<boolean> {
    return Boolean(response);
  }
}

class MyRenamedProcessor extends BaseLLMResponseProcessor {
  static get_name(): string {
    return 'CustomProcessorName';
  }

  async process_response(
    _response: CompleteResponse,
    _context: AgentContext,
    _event: LLMCompleteResponseReceivedEvent
  ): Promise<boolean> {
    return false;
  }
}

describe('BaseLLMResponseProcessor', () => {
  it('returns default name based on class name', () => {
    const processor = new MyTestProcessor();
    expect(processor.get_name()).toBe('MyTestProcessor');
  });

  it('returns overridden name', () => {
    const processor = new MyRenamedProcessor();
    expect(processor.get_name()).toBe('CustomProcessorName');
  });

  it('throws when instantiated directly', () => {
    expect(() => new (BaseLLMResponseProcessor as any)()).toThrow(
      /cannot be instantiated directly/i
    );
  });

  it('throws when subclass does not implement process_response', () => {
    class IncompleteProcessor extends BaseLLMResponseProcessor {}

    expect(() => new IncompleteProcessor()).toThrow(/implement the 'process_response' method/);
  });

  it('renders a readable string representation', () => {
    const processor = new MyTestProcessor();
    expect(processor.toString()).toBe('<MyTestProcessor>');
  });
});
