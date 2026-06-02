import type { Logger } from 'pino';
import type { ControlPlaneServerRecord } from '@/core/runtime/daemon/index.js';
import type { WorkspaceDescriptor } from '@/core/runtime/workspaces/index.js';

export type HeddleServerOptions = {
  workspaceRoot: string;
  stateRoot: string;
  preferApiKey?: boolean;
  assetsDir?: string;
  serveAssets?: boolean;
  logger?: Logger;
  runtimeHost?: HeddleRuntimeHostDescriptor;
};

export type HeddleServerListenOptions = HeddleServerOptions & {
  host: string;
  port: number;
  daemonRegistryPath?: string;
};

export type HeddleRuntimeHostDescriptor = {
  mode: ControlPlaneServerRecord['mode'];
  serverId: string;
  registryPath: string;
  endpoint: {
    host: string;
    port: number;
  };
  startedAt: string;
};

export type HeddleRuntimeHostInfo = HeddleRuntimeHostDescriptor;

export type HeddleServerContext = {
  workspaceRoot: string;
  stateRoot: string;
  preferApiKey: boolean;
  activeWorkspaceId: string;
  activeWorkspace: WorkspaceDescriptor;
  workspaces: WorkspaceDescriptor[];
  runtimeHost: HeddleRuntimeHostInfo | null;
  logger: Logger;
};
