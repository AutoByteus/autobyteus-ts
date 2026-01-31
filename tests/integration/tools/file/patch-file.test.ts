import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { defaultToolRegistry, ToolRegistry } from '../../../../src/tools/registry/tool-registry.js';
import { ToolDefinition } from '../../../../src/tools/registry/tool-definition.js';
import { BaseTool } from '../../../../src/tools/base-tool.js';
import { registerPatchFileTool } from '../../../../src/tools/file/patch-file.js';

const TOOL_NAME_PATCH_FILE = 'patch_file';

type MockContext = { agentId: string; workspace: null };

describe('patch_file tool (integration)', () => {
  beforeEach(() => {
    defaultToolRegistry.clear();
    registerPatchFileTool();
  });

  const getPatchTool = (): BaseTool => defaultToolRegistry.createTool(TOOL_NAME_PATCH_FILE) as BaseTool;

  it('patches file content on disk', async () => {
    const tmpDir = await fs.mkdtemp(path.join(process.cwd(), 'tmp-patch-file-'));
    const filePath = path.join(tmpDir, 'sample.txt');
    await fs.writeFile(filePath, 'line1\nline2\nline3\n', 'utf-8');

    const patch = `@@ -1,3 +1,3 @@
 line1
-line2
+line2 updated
 line3
`;

    const tool = getPatchTool();
    const context: MockContext = { agentId: 'agent', workspace: null };
    const result = await tool.execute(context, { path: filePath, patch });

    expect(result).toBe(`File patched successfully at ${filePath}`);
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toBe('line1\nline2 updated\nline3\n');
  });
});
