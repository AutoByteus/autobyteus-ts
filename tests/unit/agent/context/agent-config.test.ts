import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentConfig } from '../../../../src/agent/context/agent-config.js';
import { ToolManifestInjectorProcessor } from '../../../../src/agent/system-prompt-processor/tool-manifest-injector-processor.js';
import { AvailableSkillsProcessor } from '../../../../src/agent/system-prompt-processor/available-skills-processor.js';
import { BaseLLM } from '../../../../src/llm/base.js';
import { LLMModel } from '../../../../src/llm/models.js';
import { LLMProvider } from '../../../../src/llm/providers.js';
import { LLMConfig } from '../../../../src/llm/utils/llm-config.js';
import { CompleteResponse, ChunkResponse } from '../../../../src/llm/utils/response-types.js';
import { LLMUserMessage } from '../../../../src/llm/user-message.js';

class DummyLLM extends BaseLLM {
  protected async _sendUserMessageToLLM(_userMessage: LLMUserMessage): Promise<CompleteResponse> {
    return new CompleteResponse({ content: 'ok' });
  }

  protected async *_streamUserMessageToLLM(_userMessage: LLMUserMessage): AsyncGenerator<ChunkResponse, void, unknown> {
    yield new ChunkResponse({ content: 'ok', is_complete: true });
  }
}

const makeLLM = () => {
  const model = new LLMModel({
    name: 'dummy',
    value: 'dummy',
    canonicalName: 'dummy',
    provider: LLMProvider.OPENAI
  });
  return new DummyLLM(model, new LLMConfig());
};

describe('AgentConfig', () => {
  const originalEnv = process.env.AUTOBYTEUS_STREAM_PARSER;

  beforeEach(() => {
    process.env.AUTOBYTEUS_STREAM_PARSER = originalEnv;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AUTOBYTEUS_STREAM_PARSER;
    } else {
      process.env.AUTOBYTEUS_STREAM_PARSER = originalEnv;
    }
  });

  it('uses default system prompt processors when not in api_tool_call format', () => {
    process.env.AUTOBYTEUS_STREAM_PARSER = 'xml';
    const config = new AgentConfig('name', 'role', 'desc', makeLLM());

    expect(config.systemPromptProcessors.some((p) => p instanceof ToolManifestInjectorProcessor)).toBe(true);
    expect(config.systemPromptProcessors.some((p) => p instanceof AvailableSkillsProcessor)).toBe(true);
  });

  it('filters tool manifest injector in api_tool_call format', () => {
    process.env.AUTOBYTEUS_STREAM_PARSER = 'api_tool_call';
    const config = new AgentConfig('name', 'role', 'desc', makeLLM());

    expect(config.systemPromptProcessors.some((p) => p instanceof ToolManifestInjectorProcessor)).toBe(false);
    expect(config.systemPromptProcessors.some((p) => p instanceof AvailableSkillsProcessor)).toBe(true);
  });

  it('copy creates a new config with cloned lists and data', () => {
    process.env.AUTOBYTEUS_STREAM_PARSER = 'xml';
    const llm = makeLLM();
    const config = new AgentConfig('name', 'role', 'desc', llm, null, [{ name: 'tool' } as any], true, null, null, null, null, null, null, null, { nested: { value: 1 } }, ['skill-a']);

    const clone = config.copy();

    expect(clone).not.toBe(config);
    expect(clone.llmInstance).toBe(llm);
    expect(clone.tools).not.toBe(config.tools);
    expect(clone.tools).toEqual(config.tools);

    (clone.initialCustomData as any).nested.value = 2;
    expect((config.initialCustomData as any).nested.value).toBe(1);

    clone.skills.push('skill-b');
    expect(config.skills).toEqual(['skill-a']);
  });
});
