import { describe, expect, it } from 'vitest';
import { projectRuntimeHostSurface } from '../../../web/features/control-plane/host-surface.js';
import type { ControlPlaneState } from '@/server/control-plane-types.js';

describe('projectRuntimeHostSurface', () => {
  it('returns local control-plane state when no runtime host is loaded', () => {
    expect(projectRuntimeHostSurface(baseState())).toMatchObject({
      state: 'local',
      label: 'Local control plane',
      tone: 'outline',
    });
  });

  it('returns attached state when runtime host metadata is loaded', () => {
    expect(projectRuntimeHostSurface(baseState({
      runtimeHost: {
        mode: 'daemon',
        serverId: 'server-1',
        registryPath: '/tmp/registry.json',
        endpoint: { host: '127.0.0.1', port: 8765 },
        startedAt: '2026-04-21T12:00:00.000Z',
      },
    }))).toMatchObject({
      state: 'attached',
      label: 'Attached to control-plane server',
      tone: 'secondary',
      endpoint: '127.0.0.1:8765',
      serverId: 'server-1',
    });
  });
});

function baseState(overrides: Partial<ControlPlaneState> = {}): ControlPlaneState {
  return {
    workspaceRoot: '/workspace',
    stateRoot: '/workspace/.heddle',
    activeWorkspaceId: 'default',
    workspace: {
      id: 'default',
      name: 'workspace',
      workspaceRoot: '/workspace',
      stateRoot: '/workspace/.heddle',
      repoRoots: ['/workspace'],
      createdAt: '2026-04-21T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    },
    workspaces: [],
    knownWorkspaces: [],
    runtimeHost: null,
    sessions: [],
    heartbeat: {
      tasks: [],
      runs: [],
    },
    ...overrides,
  };
}
