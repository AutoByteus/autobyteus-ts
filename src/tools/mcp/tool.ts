import type { ParameterSchema } from '../../utils/parameter_schema.js';
import { BaseTool } from '../base_tool.js';
import { McpServerProxy } from './server/proxy.js';

type AgentContextLike = { agent_id: string };

type ToolArguments = Record<string, any>;

export class GenericMcpTool extends BaseTool {
  private _server_id: string;
  private _remote_tool_name: string;
  private _instance_name: string;
  private _instance_description: string;
  private _instance_argument_schema: ParameterSchema;

  constructor(
    server_id: string,
    remote_tool_name: string,
    name: string,
    description: string,
    argument_schema: ParameterSchema
  ) {
    super();
    this._server_id = server_id;
    this._remote_tool_name = remote_tool_name;
    this._instance_name = name;
    this._instance_description = description;
    this._instance_argument_schema = argument_schema;
  }

  getName(): string {
    return this._instance_name;
  }

  getDescription(): string {
    return this._instance_description;
  }

  getArgumentSchema(): ParameterSchema {
    return this._instance_argument_schema;
  }

  static getName(): string {
    return 'call_remote_mcp_tool';
  }

  static getDescription(): string {
    return 'A generic wrapper for executing remote MCP tools.';
  }

  static getArgumentSchema(): ParameterSchema | null {
    return null;
  }

  protected async _execute(context: AgentContextLike, kwargs: ToolArguments = {}): Promise<any> {
    const agentId = context.agent_id;
    const proxy = new McpServerProxy(agentId, this._server_id);
    return await proxy.callTool(this._remote_tool_name, kwargs);
  }
}
