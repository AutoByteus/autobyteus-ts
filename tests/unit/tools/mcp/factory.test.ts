import { describe, it, expect } from 'vitest';
import { McpToolFactory } from '../../../../src/tools/mcp/factory.js';
import { GenericMcpTool } from '../../../../src/tools/mcp/tool.js';
import { ParameterSchema, ParameterDefinition, ParameterType } from '../../../../src/utils/parameter_schema.js';
import { ToolConfig } from '../../../../src/tools/tool_config.js';

function buildSchema(): ParameterSchema {
  const schema = new ParameterSchema();
  schema.addParameter(
    new ParameterDefinition({
      name: 'param1',
      type: ParameterType.STRING,
      description: 'Test param'
    })
  );
  return schema;
}

describe('McpToolFactory', () => {
  it('stores configuration identifiers', () => {
    const schema = buildSchema();
    const factory = new McpToolFactory(
      'test_server_123',
      'remote_calculator',
      'MyCalculator',
      'A remote calculator tool.',
      schema
    );

    expect((factory as any)._server_id).toBe('test_server_123');
    expect((factory as any)._remote_tool_name).toBe('remote_calculator');
    expect((factory as any)._registered_tool_name).toBe('MyCalculator');
    expect((factory as any)._tool_description).toContain('remote calculator');
    expect((factory as any)._tool_argument_schema).toBe(schema);
  });

  it('creates a configured GenericMcpTool instance', () => {
    const schema = buildSchema();
    const factory = new McpToolFactory(
      'test_server_123',
      'remote_calculator',
      'MyCalculator',
      'A remote calculator tool.',
      schema
    );

    const dummyConfig = new ToolConfig({ params: { some_other_param: 'value' } });
    const toolInstance = factory.createTool(dummyConfig) as GenericMcpTool;

    expect(toolInstance).toBeInstanceOf(GenericMcpTool);
    expect((toolInstance as any)._server_id).toBe('test_server_123');
    expect((toolInstance as any)._remote_tool_name).toBe('remote_calculator');
    expect(toolInstance.getName()).toBe('MyCalculator');
    expect(toolInstance.getDescription()).toBe('A remote calculator tool.');
    expect(toolInstance.getArgumentSchema()).toBe(schema);
  });
});
