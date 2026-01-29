import fs from 'node:fs';
import { BaseManagedMcpServer } from './base_managed_mcp_server.js';
import type { WebsocketMcpServerConfig } from '../types.js';

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

function normalizeSubprotocols(subprotocols: string[] = []): string[] {
  const provided = subprotocols.filter((proto) => proto && proto.trim());
  const lowered = new Set(provided.map((proto) => proto.toLowerCase()));
  if (!lowered.has('mcp')) {
    provided.push('mcp');
  }
  return provided;
}

function buildTlsOptions(config: WebsocketMcpServerConfig): Record<string, any> | undefined {
  if (!config.url?.toLowerCase().startsWith('wss://')) {
    return undefined;
  }

  const tlsOptions: Record<string, any> = {
    rejectUnauthorized: config.verify_tls !== false
  };

  if (config.ca_file) {
    tlsOptions.ca = fs.readFileSync(config.ca_file);
  }
  if (config.client_cert) {
    tlsOptions.cert = fs.readFileSync(config.client_cert);
  }
  if (config.client_key) {
    tlsOptions.key = fs.readFileSync(config.client_key);
  }

  return tlsOptions;
}

async function loadSdk(): Promise<SdkModule> {
  const [clientModule, transportModule] = await Promise.all([
    import('@modelcontextprotocol/sdk/client/index.js'),
    import('@modelcontextprotocol/sdk/client/websocket.js')
  ]);

  const Client = (clientModule as any).Client ?? (clientModule as any).default?.Client;
  const Transport =
    (transportModule as any).WebSocketClientTransport ??
    (transportModule as any).WebsocketClientTransport ??
    (transportModule as any).default;

  if (!Client || !Transport) {
    throw new Error('MCP SDK WebSocket client transport is unavailable.');
  }

  return { Client, Transport };
}

export class WebsocketManagedMcpServer extends BaseManagedMcpServer {
  static sdkLoader: (() => Promise<SdkModule>) | null = null;

  static setSdkLoader(loader: (() => Promise<SdkModule>) | null): void {
    WebsocketManagedMcpServer.sdkLoader = loader;
  }

  protected async createClientSession(): Promise<ClientLike> {
    const config = this.config_object as WebsocketMcpServerConfig;
    const sdk = await (WebsocketManagedMcpServer.sdkLoader ?? loadSdk)();

    const transportOptions: Record<string, any> = {
      url: config.url,
      headers: config.headers ?? {},
      origin: config.origin ?? undefined,
      subprotocols: normalizeSubprotocols(config.subprotocols),
      openTimeout: config.open_timeout ?? undefined,
      pingInterval: config.ping_interval ?? undefined,
      pingTimeout: config.ping_timeout ?? undefined,
      tls: buildTlsOptions(config)
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
