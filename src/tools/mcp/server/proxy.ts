import { McpServerInstanceManager } from '../server_instance_manager.js';

type ToolArguments = Record<string, any>;

export class McpServerProxy {
  private agentId: string;
  private serverId: string;
  private instanceManager: McpServerInstanceManager;

  constructor(agentId: string, serverId: string) {
    if (!agentId || !serverId) {
      throw new Error('McpServerProxy requires both agent_id and server_id.');
    }

    this.agentId = agentId;
    this.serverId = serverId;
    this.instanceManager = McpServerInstanceManager.getInstance();
  }

  async callTool(toolName: string, argumentsPayload: ToolArguments): Promise<any> {
    const realServerInstance = this.instanceManager.getServerInstance(this.agentId, this.serverId);
    return await realServerInstance.callTool(toolName, argumentsPayload);
  }
}
