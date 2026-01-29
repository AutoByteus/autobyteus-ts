import { AgentEventHandler } from './base_event_handler.js';
import { ToolResultEvent, UserMessageReceivedEvent, BaseEvent } from '../events/agent_events.js';
import { ToolInvocationTurn } from '../tool_invocation.js';
import { ContextFile } from '../message/context_file.js';
import { AgentInputUserMessage } from '../message/agent_input_user_message.js';
import { SenderType } from '../sender_type.js';
import { formatToCleanString } from '../../utils/llm_output_formatter.js';
import type { AgentContext } from '../context/agent_context.js';

type ToolResultProcessorLike = {
  get_name: () => string;
  get_order: () => number;
  process: (event: ToolResultEvent, context: AgentContext) => Promise<ToolResultEvent>;
};

const isToolResultProcessor = (value: unknown): value is ToolResultProcessorLike => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as ToolResultProcessorLike;
  return (
    typeof candidate.get_name === 'function' &&
    typeof candidate.get_order === 'function' &&
    typeof candidate.process === 'function'
  );
};

export class ToolResultEventHandler extends AgentEventHandler {
  constructor() {
    super();
    console.info('ToolResultEventHandler initialized.');
  }

  private async dispatchResultsToInputPipeline(
    processedEvents: ToolResultEvent[],
    context: AgentContext
  ): Promise<void> {
    const agentId = context.agent_id;
    const aggregatedContentParts: string[] = [];
    const mediaContextFiles: ContextFile[] = [];

    for (const processedEvent of processedEvents) {
      const toolInvocationId = processedEvent.tool_invocation_id ?? 'N/A';

      let resultIsMedia = false;
      if (processedEvent.result instanceof ContextFile) {
        mediaContextFiles.push(processedEvent.result);
        aggregatedContentParts.push(
          `Tool: ${processedEvent.tool_name} (ID: ${toolInvocationId})\n` +
            `Status: Success\n` +
            `Result: The file '${processedEvent.result.file_name}' has been loaded into the context for you to view.`
        );
        resultIsMedia = true;
      } else if (
        Array.isArray(processedEvent.result) &&
        processedEvent.result.every((item) => item instanceof ContextFile)
      ) {
        const contextFiles = processedEvent.result as ContextFile[];
        mediaContextFiles.push(...contextFiles);
        const fileNames = contextFiles
          .map((cf) => cf.file_name)
          .filter((name): name is string => Boolean(name));
        const fileList = `[${fileNames.map((name) => `'${name}'`).join(', ')}]`;
        aggregatedContentParts.push(
          `Tool: ${processedEvent.tool_name} (ID: ${toolInvocationId})\n` +
            `Status: Success\n` +
            `Result: The following files have been loaded into the context for you to view: ${fileList}`
        );
        resultIsMedia = true;
      }

      if (resultIsMedia) {
        continue;
      }

      if (processedEvent.error) {
        aggregatedContentParts.push(
          `Tool: ${processedEvent.tool_name} (ID: ${toolInvocationId})\n` +
            `Status: Error\n` +
            `Details: ${processedEvent.error}`
        );
      } else {
        const resultStr = formatToCleanString(processedEvent.result);
        aggregatedContentParts.push(
          `Tool: ${processedEvent.tool_name} (ID: ${toolInvocationId})\n` +
            `Status: Success\n` +
            `Result:\n${resultStr}`
        );
      }
    }

    const finalContentForLLM =
      'The following tool executions have completed. Please analyze their results and decide the next course of action.\n\n' +
      aggregatedContentParts.join('\n\n---\n\n');

    console.debug(
      `Agent '${agentId}' preparing aggregated message from tool results for input pipeline:\n---\n${finalContentForLLM}\n---`
    );

    const agentInputUserMessage = new AgentInputUserMessage(
      finalContentForLLM,
      SenderType.TOOL,
      mediaContextFiles.length > 0 ? mediaContextFiles : null
    );
    const nextEvent = new UserMessageReceivedEvent(agentInputUserMessage);
    await context.input_event_queues.enqueue_user_message(nextEvent);

    console.info(
      `Agent '${agentId}' enqueued UserMessageReceivedEvent with aggregated results from ${processedEvents.length} tool(s) ` +
        `and ${mediaContextFiles.length} media file(s).`
    );
  }

  async handle(event: BaseEvent, context: AgentContext): Promise<void> {
    if (!(event instanceof ToolResultEvent)) {
      const eventType = event?.constructor?.name ?? typeof event;
      console.warn(`ToolResultEventHandler received non-ToolResultEvent: ${eventType}. Skipping.`);
      return;
    }

    const agentId = context.agent_id;
    const notifier = context.status_manager?.notifier;

    let processedEvent: ToolResultEvent = event;
    const processorInstances = context.config.tool_execution_result_processors as unknown[];
    if (processorInstances && processorInstances.length > 0) {
      const sortedProcessors = processorInstances
        .filter(isToolResultProcessor)
        .sort((left, right) => left.get_order() - right.get_order());

      for (const processor of sortedProcessors) {
        try {
          processedEvent = await processor.process(processedEvent, context);
        } catch (error) {
          console.error(
            `Agent '${agentId}': Error applying tool result processor '${processor.get_name()}': ${error}`
          );
        }
      }
    }

    const toolInvocationId = processedEvent.tool_invocation_id ?? 'N/A';
    if (notifier) {
      let logMessage = '';
      if (processedEvent.error) {
        logMessage = `[TOOL_RESULT_ERROR_PROCESSED] Agent_ID: ${agentId}, Tool: ${processedEvent.tool_name}, Invocation_ID: ${toolInvocationId}, Error: ${processedEvent.error}`;
      } else {
        logMessage = `[TOOL_RESULT_SUCCESS_PROCESSED] Agent_ID: ${agentId}, Tool: ${processedEvent.tool_name}, Invocation_ID: ${toolInvocationId}, Result: ${formatToCleanString(processedEvent.result)}`;
      }

      try {
        notifier.notify_agent_data_tool_log({
          log_entry: logMessage,
          tool_invocation_id: toolInvocationId,
          tool_name: processedEvent.tool_name
        });
        console.debug(
          `Agent '${agentId}': Notified individual tool result for '${processedEvent.tool_name}'.`
        );
      } catch (error) {
        console.error(`Agent '${agentId}': Error notifying tool result log: ${error}`);
      }
    }

    const activeTurn = context.state.active_multi_tool_call_turn as ToolInvocationTurn | null;

    if (!activeTurn) {
      console.info(
        `Agent '${agentId}' handling single ToolResultEvent from tool: '${processedEvent.tool_name}'.`
      );
      await this.dispatchResultsToInputPipeline([processedEvent], context);
      return;
    }

    activeTurn.results.push(processedEvent);
    const numResults = activeTurn.results.length;
    const numExpected = activeTurn.invocations.length;
    console.info(
      `Agent '${agentId}' handling ToolResultEvent for multi-tool call turn. Collected ${numResults}/${numExpected} results.`
    );

    if (!activeTurn.is_complete()) {
      return;
    }

    console.info(
      `Agent '${agentId}': All tool results for the turn collected. Re-ordering to match invocation sequence.`
    );

    const resultsById = new Map(
      activeTurn.results.map((result) => [result.tool_invocation_id, result])
    );
    const sortedResults: ToolResultEvent[] = [];
    for (const invocation of activeTurn.invocations) {
      const result = resultsById.get(invocation.id);
      if (result) {
        sortedResults.push(result);
      } else {
        console.error(
          `Agent '${agentId}': Missing result for invocation ID '${invocation.id}' during re-ordering.`
        );
        sortedResults.push(
          new ToolResultEvent(
            invocation.name,
            null,
            invocation.id,
            'Critical Error: Result for this tool call was lost.'
          )
        );
      }
    }

    await this.dispatchResultsToInputPipeline(sortedResults, context);
    context.state.active_multi_tool_call_turn = null;
    console.info(`Agent '${agentId}': Multi-tool call turn state has been cleared.`);
  }
}
