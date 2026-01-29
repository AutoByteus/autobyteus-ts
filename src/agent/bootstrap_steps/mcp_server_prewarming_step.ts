import { BaseBootstrapStep } from './base_bootstrap_step.js';
import { McpConfigService } from '../../tools/mcp/config_service.js';
import { McpServerInstanceManager } from '../../tools/mcp/server_instance_manager.js';
import { ToolCategory } from '../../tools/tool_category.js';
import type { AgentContext } from '../context/agent_context.js';

export class McpServerPrewarmingStep extends BaseBootstrapStep {
  private configService: McpConfigService;
  private instanceManager: McpServerInstanceManager;

  constructor() {
    super();
    this.configService = new McpConfigService();
    this.instanceManager = new McpServerInstanceManager();
    console.debug('McpServerPrewarmingStep initialized.');
  }

  async execute(context: AgentContext): Promise<boolean> {
    const agentId = context.agent_id;
    console.info(`Agent '${agentId}': Executing McpServerPrewarmingStep.`);

    const mcpServerIds = new Set<string>();
    for (const tool of context.config.tools) {
      if (tool?.definition?.category === ToolCategory.MCP) {
        const serverId = tool.definition?.metadata?.mcp_server_id;
        if (serverId) {
          mcpServerIds.add(serverId);
        }
      }
    }

    if (mcpServerIds.size === 0) {
      console.debug(`Agent '${agentId}': No MCP tools found. Skipping MCP server pre-warming.`);
      return true;
    }

    console.info(
      `Agent '${agentId}': Found ${mcpServerIds.size} unique MCP server IDs to pre-warm: ${Array.from(mcpServerIds)}`
    );

    for (const serverId of mcpServerIds) {
      try {
        const config = this.configService.getConfig(serverId);
        if (!config) {
          console.warn(
            `Agent '${agentId}': Could not find config for server_id '${serverId}' used by a tool. Cannot pre-warm.`
          );
          continue;
        }

        console.info(`Agent '${agentId}': Pre-warming MCP server '${serverId}'.`);
        const serverInstance = this.instanceManager.getServerInstance(agentId, serverId);
        await serverInstance.connect();
        console.info(
          `Agent '${agentId}': Successfully connected to pre-warmed MCP server '${serverId}'.`
        );
      } catch (error) {
        console.error(
          `Agent '${agentId}': Failed to pre-warm MCP server '${serverId}': ${error}`
        );
        return false;
      }
    }

    return true;
  }
}
