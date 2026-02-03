import { AgentEventHandler } from './base-event-handler.js';
import { PendingToolInvocationEvent, ToolResultEvent, BaseEvent } from '../events/agent-events.js';
import { ToolInvocation } from '../tool-invocation.js';
import { formatToCleanString } from '../../utils/llm-output-formatter.js';
import type { AgentContext } from '../context/agent-context.js';

type ToolInvocationPreprocessorLike = {
  getName: () => string;
  getOrder: () => number;
  process: (toolInvocation: ToolInvocation, context: AgentContext) => Promise<ToolInvocation>;
};

const isToolInvocationPreprocessor = (value: unknown): value is ToolInvocationPreprocessorLike => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as ToolInvocationPreprocessorLike;
  return (
    typeof candidate.getName === 'function' &&
    typeof candidate.getOrder === 'function' &&
    typeof candidate.process === 'function'
  );
};

export class ToolInvocationRequestEventHandler extends AgentEventHandler {
  constructor() {
    super();
    console.info('ToolInvocationRequestEventHandler initialized.');
  }

  private async executeToolDirectly(
    toolInvocation: ToolInvocation,
    context: AgentContext,
    notifier: any
  ): Promise<void> {
    const agentId = context.agentId;
    let toolName = toolInvocation.name;
    let arguments_ = toolInvocation.arguments;
    let invocationId = toolInvocation.id;
    const activeTurnId = toolInvocation.turnId ?? context.state.activeTurnId ?? undefined;

    if (notifier?.notifyAgentToolInvocationAutoExecuting) {
      try {
        notifier.notifyAgentToolInvocationAutoExecuting({
          invocation_id: invocationId,
          tool_name: toolName,
          arguments: arguments_
        });
      } catch (error) {
        console.error(`Agent '${agentId}': Error notifying tool auto-execution: ${error}`);
      }
    }

    const processors = context.config.toolInvocationPreprocessors as unknown[];
    if (processors && processors.length > 0) {
      const sortedProcessors = processors
        .filter(isToolInvocationPreprocessor)
        .sort((left, right) => left.getOrder() - right.getOrder());
      for (const processor of sortedProcessors) {
        try {
          toolInvocation = await processor.process(toolInvocation, context);
          toolName = toolInvocation.name;
          arguments_ = toolInvocation.arguments;
          invocationId = toolInvocation.id;
        } catch (error) {
          const errorMessage = `Error in tool invocation preprocessor '${processor.getName()}' for tool '${toolName}': ${error}`;
          console.error(`Agent '${agentId}': ${errorMessage}`);
          const resultEvent = new ToolResultEvent(toolName, null, invocationId, errorMessage, undefined, activeTurnId);
          await context.inputEventQueues.enqueueToolResult(resultEvent);
          return;
        }
      }
    }

    console.info(
      `Agent '${agentId}' executing tool directly: '${toolName}' (ID: ${invocationId}) with args: ${JSON.stringify(arguments_)}`
    );

    let argsStr = '';
    try {
      argsStr = formatToCleanString(arguments_);
    } catch {
      argsStr = String(arguments_);
    }

    const logMsgCall = `[TOOL_CALL_DIRECT] Agent_ID: ${agentId}, Tool: ${toolName}, Invocation_ID: ${invocationId}, Arguments: ${argsStr}`;
    if (notifier?.notifyAgentDataToolLog) {
      try {
        notifier.notifyAgentDataToolLog({
          log_entry: logMsgCall,
          tool_invocation_id: invocationId,
          tool_name: toolName
        });
      } catch (error) {
        console.error(`Agent '${agentId}': Error notifying tool call log: ${error}`);
      }
    }

    const toolInstance: any = context.getTool(toolName);
    let resultEvent: ToolResultEvent;

    if (!toolInstance) {
      const errorMessage = `Tool '${toolName}' not found or configured for agent '${agentId}'.`;
      console.error(errorMessage);
      resultEvent = new ToolResultEvent(toolName, null, invocationId, errorMessage, undefined, activeTurnId);
      const logMsgError = `[TOOL_ERROR_DIRECT] ${errorMessage}`;
      if (notifier?.notifyAgentDataToolLog) {
        try {
          notifier.notifyAgentDataToolLog({
            log_entry: logMsgError,
            tool_invocation_id: invocationId,
            tool_name: toolName
          });
          notifier.notifyAgentErrorOutputGeneration?.(
            `ToolExecutionDirect.ToolNotFound.${toolName}`,
            errorMessage
          );
        } catch (error) {
          console.error(
            `Agent '${agentId}': Error notifying tool error log/output error: ${error}`
          );
        }
      }
    } else {
      try {
        console.debug(
          `Executing tool '${toolName}' for agent '${agentId}'. Invocation ID: ${invocationId}`
        );
        const executionResult = await toolInstance.execute(context, arguments_);
        let resultJsonForLog: string;
        try {
          resultJsonForLog = formatToCleanString(executionResult);
        } catch {
          resultJsonForLog = formatToCleanString(String(executionResult));
        }

        console.info(
          `Tool '${toolName}' (ID: ${invocationId}) executed by agent '${agentId}'.`
        );
        resultEvent = new ToolResultEvent(
          toolName,
          executionResult,
          invocationId,
          undefined,
          arguments_,
          activeTurnId
        );

        const logMsgResult = `[TOOL_RESULT_DIRECT] ${resultJsonForLog}`;
        if (notifier?.notifyAgentDataToolLog) {
          try {
            notifier.notifyAgentDataToolLog({
              log_entry: logMsgResult,
              tool_invocation_id: invocationId,
              tool_name: toolName
            });
          } catch (error) {
            console.error(`Agent '${agentId}': Error notifying tool result log: ${error}`);
          }
        }
      } catch (error) {
        const errorMessage = `Error executing tool '${toolName}' (ID: ${invocationId}): ${String(error)}`;
        const errorDetails = error instanceof Error ? error.stack ?? String(error) : String(error);
        console.error(`Agent '${agentId}' ${errorMessage}`);
        resultEvent = new ToolResultEvent(toolName, null, invocationId, errorMessage, undefined, activeTurnId);
        const logMsgException = `[TOOL_EXCEPTION_DIRECT] ${errorMessage}\nDetails:\n${errorDetails}`;
        if (notifier?.notifyAgentDataToolLog) {
          try {
            notifier.notifyAgentDataToolLog({
              log_entry: logMsgException,
              tool_invocation_id: invocationId,
              tool_name: toolName
            });
            notifier.notifyAgentErrorOutputGeneration?.(
              `ToolExecutionDirect.Exception.${toolName}`,
              errorMessage,
              errorDetails
            );
          } catch (notifyError) {
            console.error(
              `Agent '${agentId}': Error notifying tool exception log/output error: ${notifyError}`
            );
          }
        }
      }
    }

    await context.inputEventQueues.enqueueToolResult(resultEvent);
    console.debug(
      `Agent '${agentId}' enqueued ToolResultEvent (direct exec) for '${toolName}' (ID: ${invocationId}).`
    );
  }

  async handle(event: BaseEvent, context: AgentContext): Promise<void> {
    if (!(event instanceof PendingToolInvocationEvent)) {
      const eventType = event?.constructor?.name ?? typeof event;
      console.warn(
        `ToolInvocationRequestEventHandler received non-PendingToolInvocationEvent: ${eventType}. Skipping.`
      );
      return;
    }

    const toolInvocation = event.toolInvocation;
    const agentId = context.agentId;
    const notifier = context.statusManager?.notifier;

    if (!notifier) {
      console.error(
        `Agent '${agentId}': Notifier not available in ToolInvocationRequestEventHandler. Output events for tool approval/logging will be lost.`
      );
      if (!context.autoExecuteTools) {
        console.error(
          `Agent '${agentId}': Notifier is REQUIRED for manual tool approval flow but is unavailable. Tool '${toolInvocation.name}' cannot be processed for approval.`
        );
        return;
      }
    }

    if (!context.autoExecuteTools) {
      console.info(
        `Agent '${agentId}': Tool '${toolInvocation.name}' (ID: ${toolInvocation.id}) requires approval. Storing pending invocation and emitting request.`
      );

      context.storePendingToolInvocation(toolInvocation);

      const approvalData = {
        invocation_id: toolInvocation.id,
        tool_name: toolInvocation.name,
        arguments: toolInvocation.arguments
      };
      if (notifier?.notifyAgentRequestToolInvocationApproval) {
        try {
          notifier.notifyAgentRequestToolInvocationApproval(approvalData);
          console.debug(
            `Agent '${agentId}': Emitted AGENT_REQUEST_TOOL_INVOCATION_APPROVAL for '${toolInvocation.name}' (ID: ${toolInvocation.id}).`
          );
        } catch (error) {
          console.error(
            `Agent '${agentId}': Error emitting AGENT_REQUEST_TOOL_INVOCATION_APPROVAL: ${error}`
          );
        }
      }
      return;
    }

    console.info(
      `Agent '${agentId}': Tool '${toolInvocation.name}' (ID: ${toolInvocation.id}) executing automatically (auto_execute_tools=True).`
    );
    await this.executeToolDirectly(toolInvocation, context, notifier);
  }
}
