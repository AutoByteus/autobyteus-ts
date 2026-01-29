import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ENV_TASK_NOTIFICATION_MODE,
  TaskNotificationMode,
  resolve_task_notification_mode
} from '../../../../src/agent_team/task_notification/task_notification_mode.js';

describe('resolve_task_notification_mode', () => {
  const originalEnv = process.env[ENV_TASK_NOTIFICATION_MODE];

  beforeEach(() => {
    if (originalEnv !== undefined) {
      process.env[ENV_TASK_NOTIFICATION_MODE] = originalEnv;
    } else {
      delete process.env[ENV_TASK_NOTIFICATION_MODE];
    }
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env[ENV_TASK_NOTIFICATION_MODE] = originalEnv;
    } else {
      delete process.env[ENV_TASK_NOTIFICATION_MODE];
    }
  });

  it('resolves default when env unset', () => {
    delete process.env[ENV_TASK_NOTIFICATION_MODE];
    expect(resolve_task_notification_mode()).toBe(TaskNotificationMode.AGENT_MANUAL_NOTIFICATION);
  });

  it('resolves env value', () => {
    process.env[ENV_TASK_NOTIFICATION_MODE] = 'system_event_driven';
    expect(resolve_task_notification_mode()).toBe(TaskNotificationMode.SYSTEM_EVENT_DRIVEN);
  });

  it('resolves env value case-insensitive', () => {
    process.env[ENV_TASK_NOTIFICATION_MODE] = 'SYSTEM_EVENT_DRIVEN';
    expect(resolve_task_notification_mode()).toBe(TaskNotificationMode.SYSTEM_EVENT_DRIVEN);
  });

  it('falls back on invalid env value', () => {
    process.env[ENV_TASK_NOTIFICATION_MODE] = 'not-a-mode';
    expect(resolve_task_notification_mode()).toBe(TaskNotificationMode.AGENT_MANUAL_NOTIFICATION);
  });
});
