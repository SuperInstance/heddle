import type { WorkspaceDescriptor } from '@/core/runtime/workspaces/index.js';

export type ControlPlaneServerRecord = {
  serverId: string;
  mode: 'daemon' | 'embedded-chat';
  host: string;
  port: number;
  pid: number;
  startedAt: string;
  lastSeenAt: string;
};

export type RegisteredWorkspaceRecord = {
  workspace: WorkspaceDescriptor;
  updatedAt: string;
};

export type DaemonRegistry = {
  version: 1;
  updatedAt: string;
  server?: ControlPlaneServerRecord;
  workspaces: RegisteredWorkspaceRecord[];
};

export type RegisterControlPlaneServerInput = {
  registryPath: string;
  server: Omit<ControlPlaneServerRecord, 'lastSeenAt'> & { lastSeenAt?: string };
};

export type ClearControlPlaneServerInput = {
  registryPath: string;
  serverId: string;
};

export type RegisterKnownWorkspacesInput = {
  registryPath?: string;
  workspaces: WorkspaceDescriptor[];
};

export type ResolveRuntimeHostInput = {
  registryPath?: string;
  now?: number;
  staleAfterMs?: number;
  isPidAlive?: (pid: number) => boolean;
};

export type ResolvedRuntimeHost =
  | {
      kind: 'none';
      registryPath: string;
    }
  | {
      kind: 'server';
      registryPath: string;
      serverId: string;
      mode: ControlPlaneServerRecord['mode'];
      endpoint: {
        host: string;
        port: number;
      };
      startedAt: string;
      lastSeenAt: string;
      stale: boolean;
      ageMs: number;
    };
