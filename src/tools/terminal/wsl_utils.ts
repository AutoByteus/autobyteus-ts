import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { accessSync } from 'node:fs';

const WSL_MISSING_MESSAGE =
  'WSL is not available. Install it with `wsl --install` and reboot, then ensure a Linux distro is installed.';

function decode_wsl_bytes(raw: Buffer): string {
  if (!raw || raw.length === 0) {
    return '';
  }
  if (raw.includes(0)) {
    return raw.toString('utf16le');
  }
  return raw.toString('utf8');
}

function fileExists(candidate: string): boolean {
  try {
    accessSync(candidate);
    return true;
  } catch {
    return false;
  }
}

function which(command: string): string | null {
  const envPath = process.env.PATH ?? '';
  const parts = envPath.split(path.delimiter).filter(Boolean);
  const extensions = process.platform === 'win32'
    ? (process.env.PATHEXT?.split(';').filter(Boolean) ?? ['.EXE', '.CMD', '.BAT'])
    : [''];

  for (const dir of parts) {
    if (!dir) {
      continue;
    }
    if (process.platform === 'win32') {
      const base = path.join(dir, command);
      if (fileExists(base)) {
        return base;
      }
      for (const ext of extensions) {
        const candidate = base.endsWith(ext) ? base : `${base}${ext}`;
        if (fileExists(candidate)) {
          return candidate;
        }
      }
    } else {
      const candidate = path.join(dir, command);
      if (fileExists(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

export function find_wsl_executable(): string | null {
  return which('wsl.exe') ?? which('wsl');
}

export function ensure_wsl_available(): string {
  const wsl_exe = find_wsl_executable();
  if (!wsl_exe) {
    throw new Error(WSL_MISSING_MESSAGE);
  }
  return wsl_exe;
}

export function list_wsl_distros(wsl_exe: string): string[] {
  const result = spawnSync(wsl_exe, ['-l', '-q'], { encoding: 'buffer', timeout: 5000 });
  if (result.status !== 0) {
    return [];
  }
  const output = decode_wsl_bytes(result.stdout ?? Buffer.alloc(0));
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function get_default_wsl_distro(wsl_exe: string): string | null {
  const result = spawnSync(wsl_exe, ['-l', '-v'], { encoding: 'buffer', timeout: 5000 });
  if (result.status !== 0) {
    return null;
  }
  const output = decode_wsl_bytes(result.stdout ?? Buffer.alloc(0));
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('*')) {
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        return parts[1];
      }
    }
  }
  return null;
}

export function ensure_wsl_distro_available(wsl_exe: string): void {
  const distros = list_wsl_distros(wsl_exe);
  if (distros.length === 0) {
    throw new Error(
      'No WSL distro is installed. Run `wsl --install` or install a distro from the Microsoft Store.'
    );
  }
}

export function select_wsl_distro(wsl_exe: string): string {
  const distros = list_wsl_distros(wsl_exe);
  if (distros.length === 0) {
    throw new Error(
      'No WSL distro is installed. Run `wsl --install` or install a distro from the Microsoft Store.'
    );
  }

  const defaultDistro = get_default_wsl_distro(wsl_exe);
  const excluded = new Set(['docker-desktop', 'docker-desktop-data']);

  if (defaultDistro && !excluded.has(defaultDistro)) {
    return defaultDistro;
  }

  for (const distro of distros) {
    if (distro && !excluded.has(distro)) {
      return distro;
    }
  }

  return defaultDistro ?? distros[0];
}

function run_wslpath(wsl_exe: string, inputPath: string): string | null {
  const result = spawnSync(wsl_exe, ['wslpath', '-a', '-u', inputPath], { encoding: 'buffer', timeout: 5000 });
  if (result.status !== 0) {
    return null;
  }
  const output = decode_wsl_bytes(result.stdout ?? Buffer.alloc(0)).trim();
  return output || null;
}

function manual_windows_path_to_wsl(inputPath: string): string {
  const parsed = path.win32.parse(inputPath);
  if (!parsed.root) {
    throw new Error(`Unsupported Windows path format: ${inputPath}`);
  }

  const drive = parsed.root.replace(/[:\\]+/g, '').toLowerCase();
  const tail = inputPath.slice(parsed.root.length).replace(/\\/g, '/');
  if (tail) {
    return `/mnt/${drive}/${tail}`;
  }
  return `/mnt/${drive}`;
}

export function windows_path_to_wsl(inputPath: string, wsl_exe?: string): string {
  if (!inputPath) {
    throw new Error('Path must be a non-empty string.');
  }
  if (inputPath.startsWith('/')) {
    return inputPath;
  }
  if (inputPath.startsWith('\\\\')) {
    throw new Error('UNC paths are not supported for WSL conversion.');
  }

  const exe = wsl_exe ?? ensure_wsl_available();
  const converted = run_wslpath(exe, inputPath);
  if (converted) {
    return converted;
  }

  return manual_windows_path_to_wsl(inputPath);
}
