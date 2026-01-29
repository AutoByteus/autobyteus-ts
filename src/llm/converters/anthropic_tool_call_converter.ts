import { ToolCallDelta } from '../utils/tool_call_delta.js';

/**
 * Convert an Anthropic stream event into ToolCallDelta objects.
 * Expects Anthropic SDK event types.
 */
export function convertAnthropicToolCall(event: any): ToolCallDelta[] | null {
  // Handle content_block_start (Start of tool use)
  if (event.type === 'content_block_start') {
    if (event.content_block?.type === 'tool_use') {
      return [{
        index: event.index,
        call_id: event.content_block.id,
        name: event.content_block.name,
        arguments_delta: undefined // No args yet
      } as ToolCallDelta];
    }
  }
  
  // Handle content_block_delta (JSON args update)
  else if (event.type === 'content_block_delta') {
    if (event.delta?.type === 'input_json_delta') {
      return [{
        index: event.index,
        call_id: undefined,
        name: undefined,
        arguments_delta: event.delta.partial_json
      } as ToolCallDelta];
    }
  }

  return null;
}
