import { BaseXmlSchemaFormatter } from './base_formatter.js';
import { ToolDefinition } from '../../registry/tool_definition.js';

export class RunBashXmlSchemaFormatter extends BaseXmlSchemaFormatter {
  provide(_toolDefinition: ToolDefinition): string {
    return `## run_bash

Runs a command in the terminal.

**Syntax:**
\`\`\`xml
<run_bash>
command_to_execute
</run_bash>
\`\`\`

**Parameters:**
- Content between tags: The shell command to execute.

The command runs in the agent's configured working directory.`;
  }
}
