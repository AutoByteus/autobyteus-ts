import { BaseExampleFormatter } from './base_formatter.js';
import { ToolDefinition } from '../../registry/tool_definition.js';

export class RunBashXmlExampleFormatter implements BaseExampleFormatter {
  provide(_toolDefinition: ToolDefinition): string {
    return `### Example 1: List files

<run_bash>
ls -la
</run_bash>

### Example 2: Run tests

<run_bash>
python -m pytest tests/ -v
</run_bash>`;
  }
}
