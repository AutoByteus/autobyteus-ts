import { describe, it, expect } from 'vitest';
import { AgentTeamEventHandlerRegistry } from '../../../../src/agent_team/handlers/agent_team_event_handler_registry.js';
import { BaseAgentTeamEventHandler } from '../../../../src/agent_team/handlers/base_agent_team_event_handler.js';
import { BaseAgentTeamEvent, AgentTeamReadyEvent } from '../../../../src/agent_team/events/agent_team_events.js';

class DummyHandler extends BaseAgentTeamEventHandler {
  async handle(): Promise<void> {
    return;
  }
}

describe('AgentTeamEventHandlerRegistry', () => {
  it('registers and retrieves handlers', () => {
    const registry = new AgentTeamEventHandlerRegistry();
    const handler = new DummyHandler();

    registry.register(AgentTeamReadyEvent, handler);

    expect(registry.get_handler(AgentTeamReadyEvent)).toBe(handler);
    expect(registry.get_handler(BaseAgentTeamEvent as any)).toBeUndefined();
  });

  it('throws for invalid event type', () => {
    const registry = new AgentTeamEventHandlerRegistry();
    const handler = new DummyHandler();

    expect(() => registry.register(String as any, handler)).toThrow(TypeError);
  });
});
