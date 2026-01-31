import { describe, it, expect, vi } from 'vitest';
import { SendMessageTo } from '../../../../src/agent/message/send-message-to.js';
import { InterAgentMessageRequestEvent } from '../../../../src/agent-team/events/agent-team-events.js';
import { ParameterSchema } from '../../../../src/utils/parameter-schema.js';

const makeTeamManager = () => ({
  dispatchInterAgentMessageRequest: vi.fn().mockResolvedValue(undefined)
});

const makeTeamContext = (teamManager: any) => ({
  teamManager: teamManager
});

const makeAgentContext = (teamContext: any) => ({
  agentId: 'sender_agent_001',
  customData: { teamContext: teamContext }
});

describe('SendMessageTo tool', () => {
  it('exposes name and description', () => {
    expect(SendMessageTo.getName()).toBe('send_message_to');
    const desc = SendMessageTo.getDescription();
    expect(desc).toContain('Sends a message to another agent');
    expect(desc).toContain('within the same team');
  });

  it('exposes argument schema', () => {
    const schema = SendMessageTo.getArgumentSchema();
    expect(schema).toBeInstanceOf(ParameterSchema);
    expect(schema?.parameters.length).toBe(3);
    expect(schema?.getParameter('recipient_name')?.required).toBe(true);
    expect(schema?.getParameter('content')?.required).toBe(true);
    expect(schema?.getParameter('message_type')?.required).toBe(true);
  });

  it('dispatches inter-agent message requests', async () => {
    const tool = new SendMessageTo();
    const teamManager = makeTeamManager();
    const context = makeAgentContext(makeTeamContext(teamManager));

    const result = await (tool as any)._execute(context, {
      recipient_name: 'Researcher',
      content: 'Please find data on topic X.',
      message_type: 'TASK_ASSIGNMENT'
    });

    expect(result).toContain("Message dispatch for recipient 'Researcher' has been successfully requested.");
    expect(teamManager.dispatchInterAgentMessageRequest).toHaveBeenCalledOnce();

    const [event] = teamManager.dispatchInterAgentMessageRequest.mock.calls[0];
    expect(event).toBeInstanceOf(InterAgentMessageRequestEvent);
    expect(event.senderAgentId).toBe('sender_agent_001');
    expect(event.recipientName).toBe('Researcher');
    expect(event.content).toBe('Please find data on topic X.');
    expect(event.messageType).toBe('TASK_ASSIGNMENT');
  });

  it('returns an error without team context', async () => {
    const tool = new SendMessageTo();
    const context = { agentId: 'lonely_agent_002', customData: {} };

    const result = await (tool as any)._execute(context, {
      recipient_name: 'any',
      content: 'any',
      message_type: 'any'
    });

    expect(result).toContain('Error: Critical error: send_message_to tool is not configured for team communication.');
  });

  it('validates empty inputs', async () => {
    const tool = new SendMessageTo();
    const teamManager = makeTeamManager();
    const context = makeAgentContext(makeTeamContext(teamManager));

    const invalidSets = [
      { recipient_name: '', content: 'valid', message_type: 'valid' },
      { recipient_name: 'valid', content: '  ', message_type: 'valid' },
      { recipient_name: 'valid', content: 'valid', message_type: '' }
    ];

    for (const invalid of invalidSets) {
      const result = await (tool as any)._execute(context, invalid);
      expect(result.startsWith('Error:')).toBe(true);
    }
  });
});
