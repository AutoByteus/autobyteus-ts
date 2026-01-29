import { AgentEventHandler } from './base_event_handler.js';
import { PendingToolInvocationEvent, ToolResultEvent, BaseEvent } from '../events/agent_events.js';
import { ToolInvocation } from '../tool_invocation.js';
import { formatToCleanString } from '../../utils/llm_output_formatter.js';
import type { AgentContext } from '../context/agent_context.js';

type ToolInvocationPreprocessorLike = {
  get_name: () => string;
  get_order: () => number;
  process: (toolInvocation: ToolInvocation, context: AgentContext) => Promise<ToolInvocation>;
};

const isToolInvocationPreprocessor = (value: unknown): value is ToolInvocationPreprocessorLike => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as ToolInvocationPreprocessorLike;
  return (
    typeof candidate.get_name === 'function' &&
    typeof candidate.get_order === 'function' &&
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
    const agentId = context.agent_id;
    let toolName = toolInvocation.name;
    let arguments_ = toolInvocation.arguments;
    let invocationId = toolInvocation.id;

    if (notifier?.notify_agent_tool_invocation_auto_executing) {
      try {
        notifier.notify_agent_tool_invocation_auto_executing({
          invocation_id: invocationId,
          tool_name: toolName,
          arguments: arguments_
        });
      } catch (error) {
        console.error(`Agent '${agentId}': Error notifying tool auto-execution: ${error}`);
      }
    }

    const processors = context.config.tool_invocation_preprocessors as unknown[];
    if (processors && processors.length > 0) {
      const sortedProcessors = processors
        .filter(isToolInvocationPreprocessor)
        .sort((left, right) => left.get_order() - right.get_order());
      for (const processor of sortedProcessors) {
        try {
          toolInvocation = await processor.process(toolInvocation, context);
          toolName = toolInvocation.name;
          arguments_ = toolInvocation.arguments;
          invocationId = toolInvocation.id;
        } catch (error) {
          const errorMessage = `Error in tool invocation preprocessor '${processor.get_name()}' for tool '${toolName}': ${error}`;
          console.error(`Agent '${agentId}': ${errorMessage}`);
          const resultEvent = new ToolResultEvent(toolName, null, invocationId, errorMessage);
          await context.input_event_queues.enqueue_tool_result(resultEvent);
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
    if (notifier?.notify_agent_data_tool_log) {
      try {
        notifier.notify_agent_data_tool_log({
          log_entry: logMsgCall,
          tool_invocation_id: invocationId,
          tool_name: toolName
        });
      } catch (error) {
        console.error(`Agent '${agentId}': Error notifying tool call log: ${error}`);
      }
    }

    const toolInstance: any = context.get_tool(toolName);
    let resultEvent: ToolResultEvent;

    if (!toolInstance) {
      const errorMessage = `Tool '${toolName}' not found or configured for agent '${agentId}'.`;
      console.error(errorMessage);
      resultEvent = new ToolResultEvent(toolName, null, invocationId, errorMessage);
      context.add_message_to_history({
        role: 'tool',
        tool_call_id: invocationId,
        name: toolName,
        content: `Error: Tool '${toolName}' execution failed. Reason: ${errorMessage}`
      });
      const logMsgError = `[TOOL_ERROR_DIRECT] ${errorMessage}`;
      if (notifier?.notify_agent_data_tool_log) {
        try {
          notifier.notify_agent_data_tool_log({
            log_entry: logMsgError,
            tool_invocation_id: invocationId,
            tool_name: toolName
          });
          notifier.notify_agent_error_output_generation?.(
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
          arguments_
        );

        context.add_message_to_history({
          role: 'tool',
          tool_call_id: invocationId,
          name: toolName,
          content: String(executionResult)
        });

        const logMsgResult = `[TOOL_RESULT_DIRECT] ${resultJsonForLog}`;
        if (notifier?.notify_agent_data_tool_log) {
          try {
            notifier.notify_agent_data_tool_log({
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
        resultEvent = new ToolResultEvent(toolName, null, invocationId, errorMessage);
        context.add_message_to_history({
          role: 'tool',
          tool_call_id: invocationId,
          name: toolName,
          content: `Error: Tool '${toolName}' execution failed. Reason: ${errorMessage}`
        });
        const logMsgException = `[TOOL_EXCEPTION_DIRECT] ${errorMessage}\nDetails:\n${errorDetails}`;
        if (notifier?.notify_agent_data_tool_log) {
          try {
            notifier.notify_agent_data_tool_log({
              log_entry: logMsgException,
              tool_invocation_id: invocationId,
              tool_name: toolName
            });
            notifier.notify_agent_error_output_generation?.(
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

    await context.input_event_queues.enqueue_tool_result(resultEvent);
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

    const toolInvocation = event.tool_invocation;
    const agentId = context.agent_id;
    const notifier = context.status_manager?.notifier;

    if (!notifier) {
      console.error(
        `Agent '${agentId}': Notifier not available in ToolInvocationRequestEventHandler. Output events for tool approval/logging will be lost.`
      );
      if (!context.auto_execute_tools) {
        console.error(
          `Agent '${agentId}': Notifier is REQUIRED for manual tool approval flow but is unavailable. Tool '${toolInvocation.name}' cannot be processed for approval.`
        );
        return;
      }
    }

    if (!context.auto_execute_tools) {
      console.info(
        `Agent '${agentId}': Tool '${toolInvocation.name}' (ID: ${toolInvocation.id}) requires approval. Storing pending invocation and emitting request.`
      );

      context.store_pending_tool_invocation(toolInvocation);

      let argumentsJson = '{}';
      try {
        argumentsJson = JSON.stringify(toolInvocation.arguments ?? {});
      } catch {
        console.warn(
          `Could not serialize args for history tool_call for '${toolInvocation.name}'. Using empty dict string.`
        );
      }

      context.add_message_to_history({
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: toolInvocation.id,
            type: 'function',
            function: {
              name: toolInvocation.name,
              arguments: argumentsJson
            }
          }
        ]
      });

      const approvalData = {
        invocation_id: toolInvocation.id,
        tool_name: toolInvocation.name,
        arguments: toolInvocation.arguments
      };
      if (notifier?.notify_agent_request_tool_invocation_approval) {
        try {
          notifier.notify_agent_request_tool_invocation_approval(approvalData);
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
