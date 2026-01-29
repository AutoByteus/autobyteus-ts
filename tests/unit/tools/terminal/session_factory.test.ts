import { describe, it, expect, afterEach } from 'vitest';
import * as sessionFactory from '../../../../src/tools/terminal/session_factory.js';

const { get_default_session_factory, _is_windows, _set_is_windows_for_tests } = sessionFactory;

afterEach(() => {
  _set_is_windows_for_tests(() => process.platform === 'win32');
});

describe('session_factory', () => {
  it('returns WslTmuxSession on Windows', () => {
    _set_is_windows_for_tests(() => true);

    const factory = get_default_session_factory();
    expect(factory.name).toBe('WslTmuxSession');
  });

  it('returns PtySession on non-Windows', () => {
    _set_is_windows_for_tests(() => false);

    const factory = get_default_session_factory();
    expect(factory.name).toBe('PtySession');
  });

  it('detects current platform', () => {
    const isWindows = _is_windows();
    expect(typeof isWindows).toBe('boolean');
  });
});
