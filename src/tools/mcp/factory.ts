import type { ParameterSchema } from '../../utils/parameter_schema.js';
import { ToolFactory } from '../factory/tool_factory.js';
import { GenericMcpTool } from './tool.js';
import type { ToolConfig } from '../tool_config.js';
import type { BaseTool } from '../base_tool.js';

export class McpToolFactory extends ToolFactory {
  private _server_id: string;
  private _remote_tool_name: string;
  private _registered_tool_name: string;
  private _tool_description: string;
  private _tool_argument_schema: ParameterSchema;

  constructor(
    server_id: string,
    remote_tool_name: string,
    registered_tool_name: string,
    tool_description: string,
    tool_argument_schema: ParameterSchema
  ) {
    super();
    this._server_id = server_id;
    this._remote_tool_name = remote_tool_name;
    this._registered_tool_name = registered_tool_name;
    this._tool_description = tool_description;
    this._tool_argument_schema = tool_argument_schema;
  }

  createTool(_config?: ToolConfig): BaseTool {
    return new GenericMcpTool(
      this._server_id,
      this._remote_tool_name,
      this._registered_tool_name,
      this._tool_description,
      this._tool_argument_schema
    );
  }
}
