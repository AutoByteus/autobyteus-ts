import { tool } from '../functional-tool.js';
import type { BaseTool } from '../base-tool.js';
import { ToolCategory } from '../tool-category.js';
import { SkillRegistry } from '../../skills/registry.js';
import { defaultToolRegistry } from '../registry/tool-registry.js';

const DESCRIPTION = [
  "Loads a skill's entry point (SKILL.md) and provides its root path context.",
  'Use this to understand a specialized skill\'s capabilities and internal assets.',
  'Args: skill_name: The registered name of the skill or a path to a skill directory.',
  'Returns: A formatted context block containing the skill\'s map, its absolute root path, and path resolution guidance.'
].join(' ');

export async function loadSkill(_context: unknown, skill_name: string): Promise<string> {
  const registry = new SkillRegistry();
  const skillName = skill_name;
  let skill = registry.getSkill(skillName);

  if (!skill) {
    try {
      skill = registry.registerSkillFromPath(skillName);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Skill '${skillName}' not found and is not a valid skill path: ${message}`);
    }
  }

  return `## Skill: ${skill.name}\nRoot Path: ${skill.rootPath}\n\n> **CRITICAL: Path Resolution When Using Tools**\n> \n> This skill uses relative paths. When using any tool that requires a file path,\n> you MUST first construct the full absolute path by combining the Root Path above\n> with the relative path from the skill instructions.\n> \n> **Example:** Root Path + \`./scripts/format.sh\` = \`${skill.rootPath}/scripts/format.sh\`\n\n${skill.content}`;
}

const TOOL_NAME = 'load_skill';
let cachedTool: BaseTool | null = null;

export function registerLoadSkillTool(): BaseTool {
  if (!defaultToolRegistry.getToolDefinition(TOOL_NAME)) {
    cachedTool = tool({
      name: TOOL_NAME,
      description: DESCRIPTION,
      category: ToolCategory.GENERAL,
      paramNames: ['context', 'skill_name']
    })(loadSkill) as BaseTool;
    return cachedTool;
  }

  if (!cachedTool) {
    cachedTool = defaultToolRegistry.createTool(TOOL_NAME) as BaseTool;
  }

  return cachedTool;
}
