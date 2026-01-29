import { describe, it, expect } from 'vitest';
import { ToolInvocationPreprocessorDefinition } from '../../../../src/agent/tool_invocation_preprocessor/processor_definition.js';
import { BaseToolInvocationPreprocessor } from '../../../../src/agent/tool_invocation_preprocessor/base_preprocessor.js';
import type { ToolInvocation } from '../../../../src/agent/tool_invocation.js';
import type { AgentContext } from '../../../../src/agent/context/agent_context.js';

class ProcA extends BaseToolInvocationPreprocessor {
  async process(invocation: ToolInvocation, _context: AgentContext): Promise<ToolInvocation> {
    return invocation;
  }
}

describe('ToolInvocationPreprocessorDefinition', () => {
  it('stores name and processor class', () => {
    const definition = new ToolInvocationPreprocessorDefinition('ProcA', ProcA);
    expect(definition.name).toBe('ProcA');
    expect(definition.processor_class).toBe(ProcA);
    expect(definition.toString()).toContain("name='ProcA'");
  });

  it('rejects invalid names', () => {
    expect(() => new ToolInvocationPreprocessorDefinition('', ProcA)).toThrow(
      /name must be a non-empty string/i
    );
  });

  it('rejects invalid processor classes', () => {
    expect(() => new ToolInvocationPreprocessorDefinition('ProcA', {} as any)).toThrow(
      /processor_class must be a class type/i
    );
  });
});
