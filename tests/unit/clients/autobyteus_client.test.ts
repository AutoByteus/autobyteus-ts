import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import axios from 'axios';
import { AutobyteusClient } from '../../../src/clients/autobyteus_client.js';

const createMock = vi.fn();

vi.mock('axios', async () => {
  return {
    default: {
      create: (...args: any[]) => createMock(...args),
      isAxiosError: (error: any) => Boolean(error?.isAxiosError)
    }
  };
});

describe('AutobyteusClient', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv, AUTOBYTEUS_API_KEY: 'test-key' };
    createMock.mockImplementation((config: any) => ({ config, get: vi.fn(), post: vi.fn() }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    createMock.mockReset();
    vi.restoreAllMocks();
  });

  it('throws when API key is missing', () => {
    delete process.env.AUTOBYTEUS_API_KEY;
    expect(() => new AutobyteusClient('https://example.com')).toThrow();
  });

  it('uses explicit server URL and disables TLS verification when no cert is provided', () => {
    process.env.AUTOBYTEUS_LLM_SERVER_URL = 'https://env-host';
    delete process.env.AUTOBYTEUS_SSL_CERT_FILE;

    const client = new AutobyteusClient('https://override-host');
    expect(client.serverUrl).toBe('https://override-host');
    expect(createMock).toHaveBeenCalledTimes(2);

    const asyncConfig = createMock.mock.calls[0][0];
    expect(asyncConfig.httpsAgent.options.rejectUnauthorized).toBe(false);
  });

  it('uses custom cert path for TLS verification', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'autobyteus-cert-'));
    const certPath = path.join(tempDir, 'cert.pem');
    await fs.writeFile(certPath, 'dummy-cert');
    process.env.AUTOBYTEUS_SSL_CERT_FILE = certPath;

    new AutobyteusClient();
    const asyncConfig = createMock.mock.calls[0][0];
    expect(asyncConfig.httpsAgent.options.ca.toString()).toBe('dummy-cert');
    expect(asyncConfig.httpsAgent.options.rejectUnauthorized).not.toBe(false);
  });

  it('enter/exit returns instance and closes', async () => {
    const client = new AutobyteusClient();
    const closeSpy = vi.spyOn(client, 'close').mockResolvedValue();

    const entered = await client.enter();
    expect(entered).toBe(client);

    await client.exit();
    expect(closeSpy).toHaveBeenCalled();
  });
});
