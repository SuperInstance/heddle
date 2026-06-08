/**
 * Snail Shell JSON-RPC over WebSocket server.
 *
 * Implements the JSON-RPC 2.0 protocol over WebSocket connections, providing
 * Fleet agents with a wire protocol to query Heddle's environment state, workspace
 * status, session metadata, and dispatch tasks.
 */

import { WebSocketServer, type WebSocket } from 'ws';
import type http from 'node:http';
import type { SymphonyShellIdentity } from '../types.js';
import { SnailShellRpcMethodRegistry } from './methods.js';

const METHOD_NOT_FOUND = { code: -32601, message: 'Method not found' };
const INVALID_REQUEST = { code: -32600, message: 'Invalid Request' };
const PARSE_ERROR = { code: -32700, message: 'Parse error' };

export type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
};

export type JsonRpcSuccess = {
  jsonrpc: '2.0';
  id: string | number;
  result: unknown;
};

export type JsonRpcError = {
  jsonrpc: '2.0';
  id: string | number | null;
  error: { code: number; message: string; data?: unknown };
};

export type SnailShellRpcServerOptions = {
  httpServer: http.Server;
  path?: string;
  maxPayload?: number;
  identity: SymphonyShellIdentity;
  workspaceRoot: string;
};

export class SnailShellRpcServer {
  private readonly wss: WebSocketServer;
  private readonly registry: SnailShellRpcMethodRegistry;

  constructor(options: SnailShellRpcServerOptions) {
    this.registry = new SnailShellRpcMethodRegistry({
      identity: options.identity,
      workspaceRoot: options.workspaceRoot,
    });

    this.wss = new WebSocketServer({
      server: options.httpServer,
      path: options.path ?? '/ws/snail-shell',
      maxPayload: options.maxPayload ?? 256 * 1024,
    });

    this.wss.on('connection', (ws) => {
      ws.on('message', (raw) => this.handleMessage(ws, raw));
      ws.on('error', (err) => {
        // Log and close
        ws.terminate();
      });

      // Send identity handshake on connect
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'snail-shell.hello',
        params: {
          identity: options.identity,
          workspaceRoot: options.workspaceRoot,
          version: '0.1.0',
        },
      }));
    });
  }

  private async handleMessage(ws: WebSocket, raw: Buffer): Promise<void> {
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(raw.toString('utf-8'));
    } catch {
      ws.send(JSON.stringify({ jsonrpc: '2.0', id: null, error: PARSE_ERROR }));
      return;
    }

    if (request.jsonrpc !== '2.0' || !request.method) {
      ws.send(JSON.stringify({ jsonrpc: '2.0', id: request.id ?? null, error: INVALID_REQUEST }));
      return;
    }

    try {
      const handler = this.registry.get(request.method);
      if (!handler) {
        ws.send(JSON.stringify({ jsonrpc: '2.0', id: request.id, error: METHOD_NOT_FOUND }));
        return;
      }

      const result = await handler(request.params);
      ws.send(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
    } catch (error: unknown) {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      }));
    }
  }

  destroy(): void {
    this.wss.close();
  }
}