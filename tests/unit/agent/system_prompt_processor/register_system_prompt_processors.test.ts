import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { registerSystemPromptProcessors } from '../../../../src/agent/system_prompt_processor/register_system_prompt_processors.js';
import { defaultSystemPromptProcessorRegistry } from '../../../../src/agent/system_prompt_processor/processor_registry.js';

const snapshotDefinitions = () => defaultSystemPromptProcessorRegistry.get_all_definitions();

describe('registerSystemPromptProcessors', () => {
  let originalDefinitions: Record<string, any> = {};

  beforeEach(() => {
    originalDefinitions = snapshotDefinitions();
    defaultSystemPromptProcessorRegistry.clear();
  });

  afterEach(() => {
    defaultSystemPromptProcessorRegistry.clear();
    for (const definition of Object.values(originalDefinitions)) {
      defaultSystemPromptProcessorRegistry.register_processor(definition);
    }
  });

  it('registers default system prompt processors', () => {
    registerSystemPromptProcessors();

    const names = defaultSystemPromptProcessorRegistry.list_processor_names();
    expect(names).toContain('ToolManifestInjector');
    expect(names).toContain('AvailableSkillsProcessor');
  });
});
