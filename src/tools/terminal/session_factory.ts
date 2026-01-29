import { PtySession } from './pty_session.js';
import { WslTmuxSession } from './wsl_tmux_session.js';

let isWindowsImpl = () => process.platform === 'win32';

export function _is_windows(): boolean {
  return isWindowsImpl();
}

export function _set_is_windows_for_tests(fn: () => boolean): void {
  isWindowsImpl = fn;
}

export function get_default_session_factory() {
  if (_is_windows()) {
    return WslTmuxSession;
  }

  return PtySession;
}
