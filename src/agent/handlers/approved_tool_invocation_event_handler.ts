import { AgentEventHandler } from './base_event_handler.js';
import { ApprovedToolInvocationEvent, ToolResultEvent, BaseEvent } from '../events/agent_events.js';
import { ToolInvocation } from '../tool_invocation.js';
import { formatToCleanString } from '../../utils/llm_output_formatter.js';
import type { AgentContext } from '../context/agent_context.js';

type ToolInvocationPreprocessorLike = {
  get_name: () => string;
  get_order: () => number;
  process: (toolInvocation: ToolInvocation, context: AgentContext) => Promise<ToolInvocation>;
};

function isToolInvocationPreprocessor(value: unknown): value is ToolInvocationPreprocessorLike {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as ToolInvocationPreprocessorLike;
  return (
    typeof candidate.get_name === 'function' &&
    typeof candidate.get_order === 'function' &&
    typeof candidate.process === 'function'
  );
}

export class ApprovedToolInvocationEventHandler extends AgentEventHandler {
  constructor() {
    super();
    console.info('ApprovedToolInvocationEventHandler initialized.');
  }

  async handle(event: BaseEvent, context: AgentContext): Promise<void> {
    if (!(event instanceof ApprovedToolInvocationEvent)) {
      const eventType = event?.constructor?.name ?? typeof event;
      console.warn(
        `ApprovedToolInvocationEventHandler received non-ApprovedToolInvocationEvent: ${eventType}. Skipping.`
      );
      return;
    }

    let toolInvocation: ToolInvocation = event.tool_invocation;
    let toolName = toolInvocation.name;
    let arguments_ = toolInvocation.arguments;
    let invocationId = toolInvocation.id;
    const agentId = context.agent_id;

    const notifier = context.status_manager?.notifier;
    if (!notifier) {
      console.error(
        `Agent '${agentId}': Notifier not available in ApprovedToolInvocationEventHandler. Tool interaction logs will not be emitted.`
      );
    }

    console.info(
      `Agent '${agentId}' handling ApprovedToolInvocationEvent for tool: '${toolName}' (ID: ${invocationId}) ` +
        `with args: ${JSON.stringify(arguments_)}`
    );

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

    const argsStr = formatToCleanString(arguments_);
    const logMsgCall = `[APPROVED_TOOL_CALL] Agent_ID: ${agentId}, Tool: ${toolName}, Invocation_ID: ${invocationId}, Arguments: ${argsStr}`;

    if (notifier?.notify_agent_data_tool_log) {
      try {
        notifier.notify_agent_data_tool_log({
          log_entry: logMsgCall,
          tool_invocation_id: invocationId,
          tool_name: toolName
        });
      } catch (error) {
        console.error(
          `Agent '${agentId}': Error notifying approved tool call log: ${error}`
        );
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
        content: `Error: Approved tool '${toolName}' execution failed. Reason: ${errorMessage}`
      });

      const logMsgError = `[APPROVED_TOOL_ERROR] ${errorMessage}`;
      if (notifier?.notify_agent_data_tool_log) {
        try {
          notifier.notify_agent_data_tool_log({
            log_entry: logMsgError,
            tool_invocation_id: invocationId,
            tool_name: toolName
          });
          notifier.notify_agent_error_output_generation?.(
            `ApprovedToolExecution.ToolNotFound.${toolName}`,
            errorMessage
          );
        } catch (error) {
          console.error(
            `Agent '${agentId}': Error notifying approved tool error log/output error: ${error}`
          );
        }
      }
    } else {
      try {
        console.debug(
          `Executing approved tool '${toolName}' for agent '${agentId}'. Invocation ID: ${invocationId}`
        );
        const executionResult = await toolInstance.execute(context, arguments_);
        const resultJsonForLog = formatToCleanString(executionResult);

        console.info(
          `Approved tool '${toolName}' (ID: ${invocationId}) executed successfully by agent '${agentId}'.`
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

        const logMsgResult = `[APPROVED_TOOL_RESULT] ${resultJsonForLog}`;
        if (notifier?.notify_agent_data_tool_log) {
          try {
            notifier.notify_agent_data_tool_log({
              log_entry: logMsgResult,
              tool_invocation_id: invocationId,
              tool_name: toolName
            });
          } catch (error) {
            console.error(
              `Agent '${agentId}': Error notifying approved tool result log: ${error}`
            );
          }
        }
      } catch (error) {
        const errorMessage = `Error executing approved tool '${toolName}' (ID: ${invocationId}): ${String(error)}`;
        const errorDetails = error instanceof Error ? error.stack ?? String(error) : String(error);
        console.error(`Agent '${agentId}' ${errorMessage}`);
        resultEvent = new ToolResultEvent(toolName, null, invocationId, errorMessage);

        context.add_message_to_history({
          role: 'tool',
          tool_call_id: invocationId,
          name: toolName,
          content: `Error: Approved tool '${toolName}' execution failed. Reason: ${errorMessage}`
        });

        const logMsgException = `[APPROVED_TOOL_EXCEPTION] ${errorMessage}\nDetails:\n${errorDetails}`;
        if (notifier?.notify_agent_data_tool_log) {
          try {
            notifier.notify_agent_data_tool_log({
              log_entry: logMsgException,
              tool_invocation_id: invocationId,
              tool_name: toolName
            });
            notifier.notify_agent_error_output_generation?.(
              `ApprovedToolExecution.Exception.${toolName}`,
              errorMessage,
              errorDetails
            );
          } catch (notifyError) {
            console.error(
              `Agent '${agentId}': Error notifying approved tool exception log/output error: ${notifyError}`
            );
          }
        }
      }
    }

    await context.input_event_queues.enqueue_tool_result(resultEvent);
    console.debug(
      `Agent '${agentId}' enqueued ToolResultEvent for approved tool '${toolName}' (ID: ${invocationId}).`
    );
  }
}
