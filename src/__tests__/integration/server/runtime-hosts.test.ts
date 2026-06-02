import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FileDaemonRegistryRepository,
  RuntimeDaemonRegistryService,
  RuntimeHostMessages,
  RuntimeHostResolver,
} from '@/core/runtime/daemon/index.js';

describe('runtime host discovery', () => {
  it('returns none when no live control-plane server exists', () => {
    const registryPath = FileDaemonRegistryRepository.resolvePath(mkdtempSync(join(tmpdir(), 'heddle-runtime-host-none-home-')));

    const resolved = RuntimeHostResolver.resolveLiveServer({ registryPath });

    expect(resolved).toMatchObject({
      kind: 'none',
      registryPath,
    });
  });

  it('returns the live control-plane server when the registry heartbeat is fresh', () => {
    const registryPath = FileDaemonRegistryRepository.resolvePath(mkdtempSync(join(tmpdir(), 'heddle-runtime-host-home-')));

    RuntimeDaemonRegistryService.registerLiveServer({
      registryPath,
      server: {
        serverId: 'server-1',
        mode: 'daemon',
        host: '127.0.0.1',
        port: 8765,
        pid: 42,
        startedAt: '2026-04-21T00:00:00.000Z',
        lastSeenAt: '2026-04-21T00:00:30.000Z',
      },
    });

    const resolved = RuntimeHostResolver.resolveLiveServer({
      registryPath,
      now: Date.parse('2026-04-21T00:00:45.000Z'),
      isPidAlive: () => true,
    });

    expect(resolved).toMatchObject({
      kind: 'server',
      serverId: 'server-1',
      endpoint: {
        host: '127.0.0.1',
        port: 8765,
      },
      stale: false,
    });
    expect(RuntimeHostMessages.formatNotice('chat', resolved)).toContain('live control-plane server');
    expect(RuntimeHostMessages.embeddedCommandConflict('chat', resolved)).toContain('Refusing embedded `chat`');
    expect(RuntimeHostMessages.daemonStartConflict(resolved)).toContain('Refusing to start a second daemon');
  });

  it('marks the live server stale when lastSeenAt is too old', () => {
    const registryPath = FileDaemonRegistryRepository.resolvePath(mkdtempSync(join(tmpdir(), 'heddle-runtime-host-stale-home-')));

    RuntimeDaemonRegistryService.registerLiveServer({
      registryPath,
      server: {
        serverId: 'server-1',
        mode: 'daemon',
        host: '127.0.0.1',
        port: 8765,
        pid: 42,
        startedAt: '2026-04-21T00:00:00.000Z',
        lastSeenAt: '2026-04-21T00:00:00.000Z',
      },
    });

    const resolved = RuntimeHostResolver.resolveLiveServer({
      registryPath,
      now: Date.parse('2026-04-21T00:01:00.000Z'),
      staleAfterMs: 10_000,
      isPidAlive: () => true,
    });

    expect(resolved).toMatchObject({
      kind: 'server',
      stale: true,
    });
    expect(RuntimeHostMessages.formatNotice('ask', resolved)).toBeUndefined();
    expect(RuntimeHostMessages.embeddedCommandConflict('ask', resolved)).toBeUndefined();
    expect(RuntimeHostMessages.daemonStartConflict(resolved)).toBeUndefined();
  });

  it('marks the live server stale when the recorded pid is gone', () => {
    const registryPath = FileDaemonRegistryRepository.resolvePath(mkdtempSync(join(tmpdir(), 'heddle-runtime-host-dead-pid-home-')));

    RuntimeDaemonRegistryService.registerLiveServer({
      registryPath,
      server: {
        serverId: 'server-1',
        mode: 'daemon',
        host: '127.0.0.1',
        port: 8765,
        pid: 4242,
        startedAt: '2026-04-21T00:00:00.000Z',
        lastSeenAt: '2026-04-21T00:00:30.000Z',
      },
    });

    const resolved = RuntimeHostResolver.resolveLiveServer({
      registryPath,
      now: Date.parse('2026-04-21T00:00:31.000Z'),
      isPidAlive: () => false,
    });

    expect(resolved).toMatchObject({
      kind: 'server',
      stale: true,
    });
    expect(RuntimeHostMessages.daemonStartConflict(resolved)).toBeUndefined();
  });
});
