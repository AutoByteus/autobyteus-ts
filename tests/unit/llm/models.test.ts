import { describe, it, expect } from 'vitest';
import { LLMModel } from '../../../src/llm/models.js';
import { LLMProvider } from '../../../src/llm/providers.js';
import { LLMRuntime } from '../../../src/llm/runtimes.js';
import { LLMConfig } from '../../../src/llm/utils/llm_config.js';

describe('LLMModel', () => {
  it('should initialize and generate API identifier', () => {
    const model = new LLMModel({
      name: 'gpt-4o',
      value: 'gpt-4o',
      canonical_name: 'gpt-4o',
      provider: LLMProvider.OPENAI,
      runtime: LLMRuntime.API
    });
    
    expect(model.name).toBe('gpt-4o');
    expect(model.model_identifier).toBe('gpt-4o');
    expect(model.default_config).toBeInstanceOf(LLMConfig);
  });

  it('should generate custom runtime identifier', () => {
    const model = new LLMModel({
      name: 'llama3',
      value: 'llama3',
      canonical_name: 'llama3',
      provider: LLMProvider.OLLAMA,
      runtime: LLMRuntime.OLLAMA,
      host_url: 'http://localhost:11434'
    });
    
    expect(model.model_identifier).toBe('llama3:ollama@localhost:11434');
  });

  it('should require host_url for non-API runtimes', () => {
    expect(() => {
      new LLMModel({
        name: 'test',
        value: 'test',
        canonical_name: 'test',
        provider: LLMProvider.OLLAMA,
        runtime: LLMRuntime.OLLAMA
      });
    }).toThrow(/host_url is required/);
  });
});
