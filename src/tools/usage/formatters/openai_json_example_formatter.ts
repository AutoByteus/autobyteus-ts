import { ToolDefinition } from '../../registry/tool_definition.js';
import { ParameterDefinition, ParameterSchema } from '../../../utils/parameter_schema.js';
import { BaseExampleFormatter } from './base_formatter.js';
import { DefaultJsonExampleFormatter } from './default_json_example_formatter.js';

export class OpenAiJsonExampleFormatter implements BaseExampleFormatter {
  provide(tool: ToolDefinition): string {
    const basicExample = this.createExampleStructure(tool, 'basic');
    let output = '### Example 1: Basic Call (Required Arguments)\n';
    output += '```json\n';
    output += JSON.stringify(basicExample, null, 2);
    output += '\n```';

    if (!this.schemaHasAdvancedParams(tool.argumentSchema)) {
      return output;
    }

    const advancedExample = this.createExampleStructure(tool, 'advanced');
    output += '\n\n### Example 2: Advanced Call (With Optional Arguments)\n';
    output += '```json\n';
    output += JSON.stringify(advancedExample, null, 2);
    output += '\n```';

    return output;
  }

  private createExampleStructure(tool: ToolDefinition, mode: 'basic' | 'advanced'): Record<string, any> {
    const argumentsPayload: Record<string, any> = {};
    const schema = tool.argumentSchema;

    if (schema && schema.parameters.length > 0) {
      const paramsToRender = mode === 'basic'
        ? schema.parameters.filter((param) => param.required)
        : schema.parameters;

      for (const param of paramsToRender) {
        if (param.objectSchema || param.arrayItemSchema) {
          const schemaSource = param.objectSchema ?? param.arrayItemSchema;
          argumentsPayload[param.name] = DefaultJsonExampleFormatter.generateExampleFromSchema(
            schemaSource as any,
            schemaSource as any,
            mode
          );
        } else {
          argumentsPayload[param.name] = this.generateSimplePlaceholder(param);
        }
      }
    }

    return {
      tool: {
        function: {
          name: tool.name,
          arguments: argumentsPayload
        }
      }
    };
  }

  private schemaHasAdvancedParams(schema: ParameterSchema | null): boolean {
    if (!schema) {
      return false;
    }
    for (const param of schema.parameters) {
      if (!param.required) {
        return true;
      }
      if (param.objectSchema && this.schemaHasAdvancedParams(param.objectSchema)) {
        return true;
      }
      if (param.arrayItemSchema instanceof ParameterSchema && this.schemaHasAdvancedParams(param.arrayItemSchema)) {
        return true;
      }
    }
    return false;
  }

  private generateSimplePlaceholder(param: ParameterDefinition): any {
    if (param.defaultValue !== undefined && param.defaultValue !== null) {
      return param.defaultValue;
    }
    return DefaultJsonExampleFormatter.generateExampleFromSchema(param.type, param.type, 'basic');
  }
}
