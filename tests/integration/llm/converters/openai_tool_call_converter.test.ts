import { describe, it, expect } from 'vitest';
import { convertOpenAIToolCalls } from '../../../../src/llm/converters/openai_tool_call_converter.js';

describe('OpenAIToolConverter (integration)', () => {
  it('returns null for empty input', () => {
    expect(convertOpenAIToolCalls(undefined)).toBeNull();
    expect(convertOpenAIToolCalls([])).toBeNull();
  });
});
