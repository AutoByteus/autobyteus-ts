import { BaseXmlSchemaFormatter } from './base_formatter.js';
import { ToolDefinition } from '../../registry/tool_definition.js';

export class PatchFileXmlSchemaFormatter extends BaseXmlSchemaFormatter {
  provide(_toolDefinition: ToolDefinition): string {
    return `<tool name="patch_file">
    <arguments>
        <arg name="path" type="string" description="The absolute or relative path to the file to patch." required="true" />
        <arg name="patch" type="string" description="The unified diff patch to apply to the file." required="true">
            IMPORTANT: To ensure reliable streaming, you MUST enclose the patch content with the sentinel tags __START_PATCH__ and __END_PATCH__.
            The parser will strip these tags, but they are critical for preventing XML parsing errors if the patch contains special characters.
        </arg>
    </arguments>
</tool>`;
  }
}
