import fs from 'fs';
import path from 'path';
import { Singleton } from '../utils/singleton.js';
import { Skill } from './model.js';
import { SkillLoader } from './loader.js';

export class SkillRegistry extends Singleton {
  private skills: Map<string, Skill> = new Map();

  constructor() {
    super();
    const existing = (SkillRegistry as any).instance as SkillRegistry | undefined;
    if (existing) {
      return existing;
    }
    (SkillRegistry as any).instance = this;
  }

  registerSkillFromPath(skillPath: string): Skill {
    const skill = SkillLoader.loadSkill(skillPath);
    this.skills.set(skill.name, skill);
    return skill;
  }

  discoverSkills(directoryPath: string): void {
    if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
      return;
    }

    const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const skillDir = path.join(directoryPath, entry.name);
      const skillFile = path.join(skillDir, 'SKILL.md');
      if (!fs.existsSync(skillFile)) {
        continue;
      }
      try {
        this.registerSkillFromPath(skillDir);
      } catch {
        continue;
      }
    }
  }

  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  listSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  clear(): void {
    this.skills.clear();
  }
}
