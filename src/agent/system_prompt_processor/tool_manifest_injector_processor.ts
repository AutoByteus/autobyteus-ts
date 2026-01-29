import { BaseSystemPromptProcessor } from './base_processor.js';
import { defaultToolRegistry } from '../../tools/registry/tool_registry.js';
import { ToolManifestProvider } from '../../tools/usage/providers/tool_manifest_provider.js';
import type { BaseTool } from '../../tools/base_tool.js';
import type { AgentContextLike } from '../context/agent_context_like.js';

export class ToolManifestInjectorProcessor extends BaseSystemPromptProcessor {
  private manifestProvider: ToolManifestProvider | null = null;

  static get_name(): string {
    return 'ToolManifestInjector';
  }

  static get_order(): number {
    return 500;
  }

  static is_mandatory(): boolean {
    return true;
  }


  process(
    system_prompt: string,
    tool_instances: Record<string, BaseTool>,
    agent_id: string,
    context: AgentContextLike
  ): string {
    const toolNames = Object.keys(tool_instances ?? {});
    if (toolNames.length === 0) {
      console.info(`Agent '${agent_id}': No tools configured. Skipping tool injection.`);
      return system_prompt;
    }

    const llm_provider = context?.llm_instance?.model?.provider;

    const tool_definitions = toolNames
      .map((name) => defaultToolRegistry.getToolDefinition(name))
      .filter((definition): definition is NonNullable<typeof definition> => Boolean(definition));

    if (tool_definitions.length === 0) {
      console.warn(`Agent '${agent_id}': Tools configured but no definitions found in registry.`);
      return system_prompt;
    }

    try {
      if (!this.manifestProvider) {
        this.manifestProvider = new ToolManifestProvider();
      }
      const tools_manifest = this.manifestProvider.provide(tool_definitions, llm_provider ?? null);

      const tools_block = `\n\n## Accessible Tools\n\n${tools_manifest}`;
      console.info(`Agent '${agent_id}': Injected ${tool_definitions.length} tools.`);
      return system_prompt + tools_block;
    } catch (error) {
      console.error(`Agent '${agent_id}': Failed to generate tool manifest: ${error}`);
      return system_prompt;
    }
  }
}
