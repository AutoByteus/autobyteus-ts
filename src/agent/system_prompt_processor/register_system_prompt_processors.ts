import { defaultSystemPromptProcessorRegistry } from './processor_registry.js';
import { SystemPromptProcessorDefinition } from './processor_definition.js';
import { ToolManifestInjectorProcessor } from './tool_manifest_injector_processor.js';
import { AvailableSkillsProcessor } from './available_skills_processor.js';

export function registerSystemPromptProcessors(): void {
  const definitions = [
    new SystemPromptProcessorDefinition(ToolManifestInjectorProcessor.getName(), ToolManifestInjectorProcessor),
    new SystemPromptProcessorDefinition(AvailableSkillsProcessor.getName(), AvailableSkillsProcessor)
  ];

  for (const definition of definitions) {
    defaultSystemPromptProcessorRegistry.registerProcessor(definition);
  }
}
