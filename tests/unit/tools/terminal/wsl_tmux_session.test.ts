import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('node-pty', () => {
  const state: { onData?: (data: string) => void; onExit?: () => void } = {};
  const mockPty = {
    onData: (cb: (data: string) => void) => {
      state.onData = cb;
    },
    onExit: (cb: () => void) => {
      state.onExit = cb;
    },
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn()
  };

  return {
    spawn: vi.fn(() => mockPty),
    __state: state,
    __mockPty: mockPty
  };
});

import { WslTmuxSession, _set_is_windows_for_tests } from '../../../../src/tools/terminal/wsl_tmux_session.js';
import * as wslUtils from '../../../../src/tools/terminal/wsl_utils.js';
import * as nodePty from 'node-pty';

const mockState = (nodePty as any).__state as { onData?: (data: string) => void; onExit?: () => void };
const mockPty = (nodePty as any).__mockPty as {
  write: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
};
const spawnMock = (nodePty as any).spawn as ReturnType<typeof vi.fn>;

describe('WslTmuxSession', () => {
  beforeEach(() => {
    _set_is_windows_for_tests(() => true);
    mockState.onData = undefined;
    mockState.onExit = undefined;
    spawnMock.mockClear();
    mockPty.write.mockClear();
    mockPty.resize.mockClear();
    mockPty.kill.mockClear();
  });

  afterEach(() => {
    _set_is_windows_for_tests(() => process.platform === 'win32');
    vi.restoreAllMocks();
  });

  it('throws on non-windows platforms', async () => {
    _set_is_windows_for_tests(() => false);
    const session = new WslTmuxSession('test');

    await expect(session.start('C:\\tmp')).rejects.toThrow('only supported on Windows');
  });

  it('spawns wsl bash session and sets prompt/cwd', async () => {
    vi.spyOn(wslUtils, 'ensure_wsl_available').mockReturnValue('wsl.exe');
    vi.spyOn(wslUtils, 'ensure_wsl_distro_available').mockReturnValue(undefined);
    vi.spyOn(wslUtils, 'select_wsl_distro').mockReturnValue('Ubuntu');
    vi.spyOn(wslUtils, 'windows_path_to_wsl').mockReturnValue('/mnt/c/tmp');

    const session = new WslTmuxSession('test');
    await session.start('C:\\tmp');

    expect(spawnMock).toHaveBeenCalledWith(
      'wsl.exe',
      ['-d', 'Ubuntu', '--exec', 'bash', '--noprofile', '--norc', '-i'],
      expect.objectContaining({ name: 'xterm-256color' })
    );

    const writes = mockPty.write.mock.calls.map((call) => call[0]);
    expect(writes.join('')).toContain("export PS1='\\w $ '\n");
    expect(writes.join('')).toContain("cd '/mnt/c/tmp'\n");
  });

  it('reads queued output', async () => {
    vi.spyOn(wslUtils, 'ensure_wsl_available').mockReturnValue('wsl.exe');
    vi.spyOn(wslUtils, 'ensure_wsl_distro_available').mockReturnValue(undefined);
    vi.spyOn(wslUtils, 'select_wsl_distro').mockReturnValue('Ubuntu');
    vi.spyOn(wslUtils, 'windows_path_to_wsl').mockReturnValue('/mnt/c/tmp');

    const session = new WslTmuxSession('test');
    await session.start('C:\\tmp');

    mockState.onData?.('hello');
    const result = await session.read(0);
    expect(result?.toString('utf8')).toContain('hello');
  });
});
