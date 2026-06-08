/**
 * Snail Shell RPC method registry.
 *
 * Central registry of JSON-RPC methods available to Fleet agents. Delegates
 * to specialized method handler classes for workspace, session, and fleet operations.
 */

import type { SymphonyShellIdentity } from '../types.js';
import { SnailShellWorkspaceMethods } from './workspace-methods.js';
import { SnailShellSessionMethods } from './session-methods.js';
import { SnailShellFleetMethods } from './fleet-methods.js';

type RpcHandler = (params: unknown) => Promise<unknown> | unknown;

export class SnailShellRpcMethodRegistry {
  private readonly methods = new Map<string, RpcHandler>();

  constructor(options: {
    identity: SymphonyShellIdentity;
    workspaceRoot: string;
  }) {
    const workspace = new SnailShellWorkspaceMethods(options);
    const sessions = new SnailShellSessionMethods(options);
    const fleet = new SnailShellFleetMethods(options);

    // Workspace introspection
    this.register('workspace.list', () => workspace.list());
    this.register('workspace.status', (p) => workspace.status(p));
    this.register('workspace.changes', (p) => workspace.changes(p));

    // Session introspection (read-only Fleet queries)
    this.register('session.list', () => sessions.list());
    this.register('session.get', (p) => sessions.get(p));
    this.register('session.runtimeContext', (p) => sessions.runtimeContext(p));

    // Fleet communication
    this.register('fleet.t-minus', (p) => fleet.handleTMinus(p));
    this.register('fleet.identity', () => fleet.getIdentity());
    this.register('fleet.health', () => fleet.getHealth());
  }

  register(method: string, handler: RpcHandler): void {
    this.methods.set(method, handler);
  }

  get(method: string): RpcHandler | undefined {
    return this.methods.get(method);
  }
}