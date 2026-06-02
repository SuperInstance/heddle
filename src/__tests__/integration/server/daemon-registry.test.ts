import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileDaemonRegistryRepository, RuntimeDaemonRegistryService } from '@/core/runtime/daemon/index.js';
import { RuntimeWorkspaceService } from '@/core/runtime/workspaces/index.js';

describe('daemon registry', () => {
  it('records a live control-plane server independently from known workspaces', () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'heddle-daemon-registry-'));
    const stateRoot = join(workspaceRoot, '.heddle');
    const registryPath = FileDaemonRegistryRepository.resolvePath(mkdtempSync(join(tmpdir(), 'heddle-daemon-registry-home-')));
    const catalog = RuntimeWorkspaceService.ensureCatalog({ workspaceRoot, stateRoot });

    RuntimeDaemonRegistryService.registerKnownWorkspaces({ registryPath, workspaces: catalog.workspaces });
    const registry = RuntimeDaemonRegistryService.registerLiveServer({
      registryPath,
      server: {
        serverId: 'server-1',
        mode: 'daemon',
        host: '127.0.0.1',
        port: 8765,
        pid: 1234,
        startedAt: '2026-04-21T00:00:00.000Z',
      },
    });

    expect(registry.server).toMatchObject({
      serverId: 'server-1',
      host: '127.0.0.1',
      port: 8765,
    });
    expect(registry.workspaces).toEqual([
      expect.objectContaining({
        workspace: expect.objectContaining({
          id: catalog.activeWorkspaceId,
          workspaceRoot,
        }),
      }),
    ]);
    expect(RuntimeDaemonRegistryService.readWorkspaceRegistration(registryPath, catalog.activeWorkspaceId)?.workspace.workspaceRoot).toBe(workspaceRoot);
  });

  it('clears only the matching live control-plane server', () => {
    const registryPath = FileDaemonRegistryRepository.resolvePath(mkdtempSync(join(tmpdir(), 'heddle-daemon-clear-home-')));

    RuntimeDaemonRegistryService.registerLiveServer({
      registryPath,
      server: {
        serverId: 'server-1',
        mode: 'daemon',
        host: '127.0.0.1',
        port: 8765,
        pid: 1234,
        startedAt: '2026-04-21T00:00:00.000Z',
      },
    });

    RuntimeDaemonRegistryService.clearLiveServer({
      registryPath,
      serverId: 'server-2',
    });
    expect(RuntimeDaemonRegistryService.read(registryPath).server?.serverId).toBe('server-1');

    RuntimeDaemonRegistryService.clearLiveServer({
      registryPath,
      serverId: 'server-1',
    });
    expect(RuntimeDaemonRegistryService.read(registryPath).server).toBeUndefined();
  });

  it('keeps generated workspace ids distinct across registered roots', () => {
    const firstRoot = mkdtempSync(join(tmpdir(), 'heddle-daemon-registry-first-'));
    const secondRoot = mkdtempSync(join(tmpdir(), 'heddle-daemon-registry-second-'));
    const registryPath = FileDaemonRegistryRepository.resolvePath(mkdtempSync(join(tmpdir(), 'heddle-daemon-registry-global-home-')));
    const firstCatalog = RuntimeWorkspaceService.ensureCatalog({ workspaceRoot: firstRoot, stateRoot: join(firstRoot, '.heddle') });
    const secondCatalog = RuntimeWorkspaceService.ensureCatalog({ workspaceRoot: secondRoot, stateRoot: join(secondRoot, '.heddle') });

    RuntimeDaemonRegistryService.registerKnownWorkspaces({ registryPath, workspaces: firstCatalog.workspaces });
    const registry = RuntimeDaemonRegistryService.registerKnownWorkspaces({ registryPath, workspaces: secondCatalog.workspaces });

    expect(registry.workspaces).toHaveLength(2);
    expect(RuntimeDaemonRegistryService.readWorkspaceRegistration(registryPath, firstCatalog.activeWorkspaceId)?.workspace.workspaceRoot).toBe(firstRoot);
    expect(RuntimeDaemonRegistryService.readWorkspaceRegistration(registryPath, secondCatalog.activeWorkspaceId)?.workspace.workspaceRoot).toBe(secondRoot);
  });

  it('normalizes legacy workspace-owner records into a top-level live server', () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'heddle-daemon-registry-legacy-'));
    const stateRoot = join(workspaceRoot, '.heddle');
    const registryPath = FileDaemonRegistryRepository.resolvePath(mkdtempSync(join(tmpdir(), 'heddle-daemon-registry-legacy-home-')));
    const catalog = RuntimeWorkspaceService.ensureCatalog({ workspaceRoot, stateRoot });

    writeFileSync(registryPath, `${JSON.stringify({
      version: 1,
      updatedAt: '2026-04-21T00:00:30.000Z',
      workspaces: [{
        workspace: catalog.workspaces[0],
        owner: {
          ownerId: 'legacy-owner',
          mode: 'daemon',
          host: '127.0.0.1',
          port: 8765,
          pid: 1234,
          startedAt: '2026-04-21T00:00:00.000Z',
          lastSeenAt: '2026-04-21T00:00:30.000Z',
        },
        updatedAt: '2026-04-21T00:00:30.000Z',
      }],
    }, null, 2)}\n`, 'utf8');

    const registry = RuntimeDaemonRegistryService.read(registryPath);

    expect(registry.server).toMatchObject({
      serverId: 'legacy-owner',
      mode: 'daemon',
      host: '127.0.0.1',
      port: 8765,
    });
    expect(readFileSync(registryPath, 'utf8')).toContain('owner');
    expect(RuntimeDaemonRegistryService.registerKnownWorkspaces({ registryPath, workspaces: catalog.workspaces }).workspaces[0]).not.toHaveProperty('owner');
  });
});
