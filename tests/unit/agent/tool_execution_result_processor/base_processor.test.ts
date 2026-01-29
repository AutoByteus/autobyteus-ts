import { describe, it, expect } from 'vitest';
import { BaseToolExecutionResultProcessor } from '../../../../src/agent/tool_execution_result_processor/base_processor.js';
import type { ToolResultEvent } from '../../../../src/agent/events/agent_events.js';
import type { AgentContext } from '../../../../src/agent/context/agent_context.js';

class MyTestProcessor extends BaseToolExecutionResultProcessor {
  async process(event: ToolResultEvent, _context: AgentContext): Promise<ToolResultEvent> {
    return event;
  }
}

class MyRenamedProcessor extends BaseToolExecutionResultProcessor {
  static get_name(): string {
    return 'CustomProcessorName';
  }

  async process(event: ToolResultEvent, _context: AgentContext): Promise<ToolResultEvent> {
    return event;
  }
}

describe('BaseToolExecutionResultProcessor', () => {
  it('returns default name based on class name', () => {
    const processor = new MyTestProcessor();
    expect(processor.get_name()).toBe('MyTestProcessor');
  });

  it('returns overridden name', () => {
    const processor = new MyRenamedProcessor();
    expect(processor.get_name()).toBe('CustomProcessorName');
  });

  it('throws when instantiated directly', () => {
    expect(() => new (BaseToolExecutionResultProcessor as any)()).toThrow(
      /cannot be instantiated directly/i
    );
  });

  it('throws when subclass does not implement process', () => {
    class IncompleteProcessor extends BaseToolExecutionResultProcessor {}

    expect(() => new IncompleteProcessor()).toThrow(/implement the 'process' method/);
  });

  it('renders a readable string representation', () => {
    const processor = new MyTestProcessor();
    expect(processor.toString()).toBe('<MyTestProcessor>');
  });
});
