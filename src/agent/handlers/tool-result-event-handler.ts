import { AgentEventHandler } from './base-event-handler.js';
import { ToolResultEvent, UserMessageReceivedEvent, BaseEvent } from '../events/agent-events.js';
import { ToolInvocationTurn } from '../tool-invocation.js';
import { ContextFile } from '../message/context-file.js';
import { AgentInputUserMessage } from '../message/agent-input-user-message.js';
import { SenderType } from '../sender-type.js';
import { formatToCleanString } from '../../utils/llm-output-formatter.js';
import type { AgentContext } from '../context/agent-context.js';

type ToolResultProcessorLike = {
  getName: () => string;
  getOrder: () => number;
  process: (event: ToolResultEvent, context: AgentContext) => Promise<ToolResultEvent>;
};

const isToolResultProcessor = (value: unknown): value is ToolResultProcessorLike => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as ToolResultProcessorLike;
  return (
    typeof candidate.getName === 'function' &&
    typeof candidate.getOrder === 'function' &&
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
    const agentId = context.agentId;
    const aggregatedContentParts: string[] = [];
    const mediaContextFiles: ContextFile[] = [];

    for (const processedEvent of processedEvents) {
      const toolInvocationId = processedEvent.toolInvocationId ?? 'N/A';

      let resultIsMedia = false;
      if (processedEvent.result instanceof ContextFile) {
        mediaContextFiles.push(processedEvent.result);
        aggregatedContentParts.push(
          `Tool: ${processedEvent.toolName} (ID: ${toolInvocationId})\n` +
            `Status: Success\n` +
            `Result: The file '${processedEvent.result.fileName}' has been loaded into the context for you to view.`
        );
        resultIsMedia = true;
      } else if (
        Array.isArray(processedEvent.result) &&
        processedEvent.result.every((item) => item instanceof ContextFile)
      ) {
        const contextFiles = processedEvent.result as ContextFile[];
        mediaContextFiles.push(...contextFiles);
        const fileNames = contextFiles
          .map((cf) => cf.fileName)
          .filter((name): name is string => Boolean(name));
        const fileList = `[${fileNames.map((name) => `'${name}'`).join(', ')}]`;
        aggregatedContentParts.push(
          `Tool: ${processedEvent.toolName} (ID: ${toolInvocationId})\n` +
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
          `Tool: ${processedEvent.toolName} (ID: ${toolInvocationId})\n` +
            `Status: Error\n` +
            `Details: ${processedEvent.error}`
        );
      } else {
        const resultStr = formatToCleanString(processedEvent.result);
        aggregatedContentParts.push(
          `Tool: ${processedEvent.toolName} (ID: ${toolInvocationId})\n` +
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
    await context.inputEventQueues.enqueueUserMessage(nextEvent);

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

    if (!event.turnId && context.state.activeTurnId) {
      event.turnId = context.state.activeTurnId;
    }

    const agentId = context.agentId;
    const notifier = context.statusManager?.notifier;

    let processedEvent: ToolResultEvent = event;
    const processorInstances = context.config.toolExecutionResultProcessors as unknown[];
    if (processorInstances && processorInstances.length > 0) {
      const sortedProcessors = processorInstances
        .filter(isToolResultProcessor)
        .sort((left, right) => left.getOrder() - right.getOrder());

      for (const processor of sortedProcessors) {
        try {
          processedEvent = await processor.process(processedEvent, context);
        } catch (error) {
          console.error(
            `Agent '${agentId}': Error applying tool result processor '${processor.getName()}': ${error}`
          );
        }
      }
    }

    const toolInvocationId = processedEvent.toolInvocationId ?? 'N/A';
    if (notifier) {
      let logMessage = '';
      if (processedEvent.error) {
        logMessage = `[TOOL_RESULT_ERROR_PROCESSED] Agent_ID: ${agentId}, Tool: ${processedEvent.toolName}, Invocation_ID: ${toolInvocationId}, Error: ${processedEvent.error}`;
      } else {
        logMessage = `[TOOL_RESULT_SUCCESS_PROCESSED] Agent_ID: ${agentId}, Tool: ${processedEvent.toolName}, Invocation_ID: ${toolInvocationId}, Result: ${formatToCleanString(processedEvent.result)}`;
      }

      try {
        notifier.notifyAgentDataToolLog({
          log_entry: logMessage,
          tool_invocation_id: toolInvocationId,
          tool_name: processedEvent.toolName
        });
        console.debug(
          `Agent '${agentId}': Notified individual tool result for '${processedEvent.toolName}'.`
        );
      } catch (error) {
        console.error(`Agent '${agentId}': Error notifying tool result log: ${error}`);
      }
    }

    const activeTurn = context.state.activeMultiToolCallTurn as ToolInvocationTurn | null;

    if (!activeTurn) {
      console.info(
        `Agent '${agentId}' handling single ToolResultEvent from tool: '${processedEvent.toolName}'.`
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

    if (!activeTurn.isComplete()) {
      return;
    }

    console.info(
      `Agent '${agentId}': All tool results for the turn collected. Re-ordering to match invocation sequence.`
    );

    const resultsById = new Map(
      activeTurn.results.map((result) => [(result as ToolResultEvent).toolInvocationId, result])
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
            'Critical Error: Result for this tool call was lost.',
            undefined,
            invocation.turnId ?? context.state.activeTurnId ?? undefined
          )
        );
      }
    }

    await this.dispatchResultsToInputPipeline(sortedResults, context);
    context.state.activeMultiToolCallTurn = null;
    console.info(`Agent '${agentId}': Multi-tool call turn state has been cleared.`);
  }
}
