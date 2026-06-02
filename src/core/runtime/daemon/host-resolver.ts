/**
 * Runtime host resolver.
 *
 * Resolves whether this machine already has a live local control-plane server.
 * This is server-discovery policy, not workspace selection or presentation.
 */
import dayjs from 'dayjs';
import { FileDaemonRegistryRepository } from './registry-repository.js';
import { RuntimeDaemonRegistryService } from './registry-service.js';
import type { ResolvedRuntimeHost, ResolveRuntimeHostInput } from './types.js';

const DEFAULT_STALE_AFTER_MS = 45_000;

export class RuntimeHostResolver {
  static resolveLiveServer(input: ResolveRuntimeHostInput = {}): ResolvedRuntimeHost {
    const registryPath = input.registryPath ?? FileDaemonRegistryRepository.resolvePath();
    const server = RuntimeDaemonRegistryService.read(registryPath).server;

    if (!server) {
      return {
        kind: 'none',
        registryPath,
      };
    }

    const now = dayjs(input.now);
    const lastSeenAt = dayjs(server.lastSeenAt);
    const ageMs = lastSeenAt.isValid() ? Math.max(0, now.diff(lastSeenAt)) : Number.POSITIVE_INFINITY;
    const staleByAge = ageMs > (input.staleAfterMs ?? DEFAULT_STALE_AFTER_MS);
    const pidAlive = server.pid > 0 ? (input.isPidAlive ?? RuntimeHostResolver.isPidAlive)(server.pid) : true;
    const stale = staleByAge || !pidAlive;

    return {
      kind: 'server',
      registryPath,
      serverId: server.serverId,
      mode: server.mode,
      endpoint: {
        host: server.host,
        port: server.port,
      },
      startedAt: server.startedAt,
      lastSeenAt: server.lastSeenAt,
      stale,
      ageMs,
    };
  }

  private static isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      if (RuntimeHostResolver.isNodeError(error) && error.code === 'EPERM') {
        return true;
      }
      return false;
    }
  }

  private static isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return typeof error === 'object' && error !== null && 'code' in error;
  }
}
