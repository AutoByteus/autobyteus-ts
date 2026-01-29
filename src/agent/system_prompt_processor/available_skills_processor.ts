import { BaseSystemPromptProcessor } from './base_processor.js';
import { SkillRegistry } from '../../skills/registry.js';
import type { BaseTool } from '../../tools/base_tool.js';
import type { AgentContextLike } from '../context/agent_context_like.js';

export class AvailableSkillsProcessor extends BaseSystemPromptProcessor {
  static get_name(): string {
    return 'AvailableSkillsProcessor';
  }

  static is_mandatory(): boolean {
    return true;
  }


  process(
    system_prompt: string,
    _tool_instances: Record<string, BaseTool>,
    agent_id: string,
    context: AgentContextLike
  ): string {
    const registry = new SkillRegistry();
    const all_skills = registry.listSkills();

    if (!all_skills.length) {
      console.info(`Agent '${agent_id}': No skills found in registry. Skipping injection.`);
      return system_prompt;
    }

    const preloaded_skills_names = context?.config?.skills ?? [];
    const catalog_entries: string[] = [];
    const detailed_sections: string[] = [];

    for (const skill of all_skills) {
      catalog_entries.push(`- **${skill.name}**: ${skill.description}`);
      if (preloaded_skills_names.includes(skill.name)) {
        detailed_sections.push(
          `#### ${skill.name}\n**Root Path:** \`${skill.rootPath}\`\n\n${skill.content}`
        );
      }
    }

    let skills_block = '\n\n## Agent Skills\n';
    skills_block += '### Skill Catalog\n';
    skills_block += `${catalog_entries.join('\n')}\n`;
    skills_block += '\nTo load a skill not shown in detail below, use the `load_skill` tool.\n';

    if (detailed_sections.length) {
      skills_block += `
### Critical Rules for Using Skills

> **Path Resolution Required for Skill Files**
> 
> Skill instructions use relative paths (e.g., \`./scripts/run.sh\` or \`scripts/run.sh\`) to refer to internal files.
> However, standard tools resolve relative paths against the User's Workspace, not the skill directory.
> 
> When using ANY file from a skill, you MUST convert its path to ABSOLUTE:
> \`Root Path\` + \`Relative Path\` = \`Absolute Path\`
> 
> **Examples:**
> 1. Root Path: \`/path/to/skill\`
>    Relative: \`./scripts/run.sh\`
>    Result: \`/path/to/skill/scripts/run.sh\`
> 
> 2. Root Path: \`/path/to/skill\`
>    Relative: \`scripts/run.sh\`
>    Result: \`/path/to/skill/scripts/run.sh\`

`;
      skills_block += '### Skill Details\n';
      skills_block += `${detailed_sections.join('\n')}\n`;
    }

    console.info(
      `Agent '${agent_id}': Injected ${catalog_entries.length} skills in catalog, ${detailed_sections.length} with details.`
    );
    return system_prompt + skills_block;
  }
}
