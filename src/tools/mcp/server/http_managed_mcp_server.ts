import { BaseManagedMcpServer } from './base_managed_mcp_server.js';
import type { StreamableHttpMcpServerConfig } from '../types.js';

type ClientLike = {
  connect?: (transport: any) => Promise<void>;
  initialize?: () => Promise<void>;
  close?: () => Promise<void> | void;
  listTools: () => Promise<any>;
  callTool: (...args: any[]) => Promise<any>;
};

type SdkModule = {
  Client: new (...args: any[]) => ClientLike;
  Transport: new (...args: any[]) => any;
};

async function loadSdk(): Promise<SdkModule> {
  const [clientModule, transportModule] = await Promise.all([
    import('@modelcontextprotocol/sdk/client/index.js'),
    import('@modelcontextprotocol/sdk/client/streamableHttp.js')
  ]);

  const Client = (clientModule as any).Client ?? (clientModule as any).default?.Client;
  const Transport =
    (transportModule as any).StreamableHTTPClientTransport ??
    (transportModule as any).StreamableHttpClientTransport ??
    (transportModule as any).default;

  if (!Client || !Transport) {
    throw new Error('MCP SDK streamable HTTP client transport is unavailable.');
  }

  return { Client, Transport };
}

export class HttpManagedMcpServer extends BaseManagedMcpServer {
  static sdkLoader: (() => Promise<SdkModule>) | null = null;

  static setSdkLoader(loader: (() => Promise<SdkModule>) | null): void {
    HttpManagedMcpServer.sdkLoader = loader;
  }

  protected async createClientSession(): Promise<ClientLike> {
    const config = this.config_object as StreamableHttpMcpServerConfig;
    const sdk = await (HttpManagedMcpServer.sdkLoader ?? loadSdk)();

    const transportOptions = {
      url: config.url,
      headers: config.headers ?? {}
    };

    let transport: any;
    try {
      transport = new sdk.Transport(config.url, transportOptions);
    } catch {
      transport = new sdk.Transport(transportOptions);
    }

    if (typeof transport.close === 'function') {
      this.registerCleanup(() => transport.close());
    }

    const client = this.createClientInstance(sdk.Client);

    if (typeof client.connect === 'function') {
      await client.connect(transport);
    }

    if (typeof client.initialize === 'function') {
      await client.initialize();
    }

    return client;
  }

  private createClientInstance(ClientCtor: new (...args: any[]) => ClientLike): ClientLike {
    try {
      return new ClientCtor({ name: 'autobyteus', version: '1.0.0' });
    } catch {
      return new ClientCtor();
    }
  }
}
