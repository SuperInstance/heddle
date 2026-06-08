/**
 * Snail Shell daemon plugin integration.
 *
 * Attaches Snail Shell components (WebSocket JSON-RPC server and Fleet cue loop)
 * to a running Heddle daemon, enabling multi-workspace residency and Fleet communication.
 */

import type http from 'node:http';
import type express from 'express';
import type { HeddleControlPlaneServerHandle } from '@/server/types.js';
import type { SymphonyShellIdentity } from '../types.js';
import { SnailShellRpcServer } from '../rpc/server.js';
import { SnailShellFleetCueLoop } from './fleet-cue-loop.js';

export type SnailShellDaemonPluginOptions = {
  identity: SymphonyShellIdentity;
  workspaceRoot: string;
  stateRoot: string;
  expressApp: express.Application;
  httpServer: http.Server;
};

export type SnailShellDaemonHandle = {
  rpcServer: SnailShellRpcServer;
  cueLoop: SnailShellFleetCueLoop;
  identity: SymphonyShellIdentity;
  close: () => void;
};

/**
 * Attach Snail Shell to a running daemon:
 * 1. Start WebSocket JSON-RPC on the same HTTP server (path: /ws/snail-shell)
 * 2. Start Fleet cue polling loop
 * 3. Enrich the daemon handle with Snail Shell metadata
 */
export function attachSnailShellToDaemon(
  options: SnailShellDaemonPluginOptions,
  serverHandle: HeddleControlPlaneServerHandle,
): HeddleControlPlaneServerHandle & { snailShell: SnailShellDaemonHandle } {
  const rpcServer = new SnailShellRpcServer({
    httpServer: options.httpServer,
    path: '/ws/snail-shell',
    maxPayload: 256 * 1024,
    identity: options.identity,
    workspaceRoot: options.workspaceRoot,
  });

  const cueLoop = new SnailShellFleetCueLoop({
    identity: options.identity,
    workspaceRoot: options.workspaceRoot,
    stateRoot: options.stateRoot,
    cuePollIntervalMs: options.identity.frequency.cuePollIntervalMs,
  });

  cueLoop.start();

  return Object.assign(serverHandle, {
    snailShell: {
      rpcServer,
      cueLoop,
      identity: options.identity,
      close: () => {
        cueLoop.stop();
        rpcServer.destroy();
      },
    },
  });
}