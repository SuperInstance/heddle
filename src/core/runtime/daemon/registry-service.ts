/**
 * Runtime daemon registry service.
 *
 * Owns the domain behavior for recording known workspaces and the one live
 * local control-plane server. Workspace records are identity/catalog facts;
 * server liveness is top-level process state and must not be stored as
 * workspace ownership.
 */
import { resolve } from 'node:path';
import { DaemonRegistryReadSchema } from './schemas.js';
import { FileDaemonRegistryRepository } from './registry-repository.js';
import type {
  ClearControlPlaneServerInput,
  ControlPlaneServerRecord,
  DaemonRegistry,
  RegisterControlPlaneServerInput,
  RegisteredWorkspaceRecord,
  RegisterKnownWorkspacesInput,
} from './types.js';
import type { WorkspaceDescriptor } from '@/core/runtime/workspaces/index.js';

export class RuntimeDaemonRegistryService {
  static read(registryPath: string): DaemonRegistry {
    const repository = new FileDaemonRegistryRepository({ registryPath });
    return RuntimeDaemonRegistryService.normalizeRegistry(repository.readRaw());
  }

  static registerLiveServer(input: RegisterControlPlaneServerInput): DaemonRegistry {
    const registry = RuntimeDaemonRegistryService.read(input.registryPath);
    const now = input.server.lastSeenAt ?? new Date().toISOString();

    return RuntimeDaemonRegistryService.saveNext(input.registryPath, {
      version: 1,
      updatedAt: now,
      server: {
        ...input.server,
        lastSeenAt: now,
      },
      workspaces: registry.workspaces,
    });
  }

  static clearLiveServer(input: ClearControlPlaneServerInput): DaemonRegistry {
    const registry = RuntimeDaemonRegistryService.read(input.registryPath);
    const now = new Date().toISOString();
    const server = registry.server?.serverId === input.serverId ? undefined : registry.server;

    return RuntimeDaemonRegistryService.saveNext(input.registryPath, {
      version: 1,
      updatedAt: now,
      server,
      workspaces: registry.workspaces,
    });
  }

  static readWorkspaceRegistration(
    registryPath: string,
    workspaceId: string,
    stateRoot?: string,
  ): RegisteredWorkspaceRecord | null {
    const registry = RuntimeDaemonRegistryService.read(registryPath);
    const normalizedStateRoot = stateRoot ? resolve(stateRoot) : undefined;
    return registry.workspaces.find((record) => (
      normalizedStateRoot ?
        resolve(record.workspace.stateRoot) === normalizedStateRoot
      : record.workspace.id === workspaceId
    )) ?? null;
  }

  static registerKnownWorkspaces(input: RegisterKnownWorkspacesInput): DaemonRegistry {
    const registryPath = input.registryPath ?? FileDaemonRegistryRepository.resolvePath();
    const registry = RuntimeDaemonRegistryService.read(registryPath);
    const now = new Date().toISOString();
    const nextRecords = RuntimeDaemonRegistryService.toRecordMap(registry.workspaces);

    for (const workspace of input.workspaces) {
      nextRecords.set(RuntimeDaemonRegistryService.workspaceRecordKey(workspace), {
        workspace,
        updatedAt: now,
      });
    }

    return RuntimeDaemonRegistryService.saveNext(registryPath, {
      version: 1,
      updatedAt: now,
      server: registry.server,
      workspaces: Array.from(nextRecords.values()),
    });
  }

  private static saveNext(registryPath: string, registry: DaemonRegistry): DaemonRegistry {
    new FileDaemonRegistryRepository({ registryPath }).save(registry);
    return registry;
  }

  private static createEmptyRegistry(): DaemonRegistry {
    return {
      version: 1,
      updatedAt: new Date(0).toISOString(),
      workspaces: [],
    };
  }

  private static normalizeRegistry(raw: unknown): DaemonRegistry {
    if (raw === undefined) {
      return RuntimeDaemonRegistryService.createEmptyRegistry();
    }

    const parsed = DaemonRegistryReadSchema.safeParse(raw);
    if (!parsed.success) {
      return RuntimeDaemonRegistryService.createEmptyRegistry();
    }

    return {
      version: 1,
      updatedAt: parsed.data.updatedAt?.trim() || new Date().toISOString(),
      server: RuntimeDaemonRegistryService.normalizeServer(parsed.data.server)
        ?? RuntimeDaemonRegistryService.normalizeLegacyServer(parsed.data.workspaces ?? []),
      workspaces: (parsed.data.workspaces ?? []).flatMap((record) => (
        record.workspace ? [RuntimeDaemonRegistryService.normalizeWorkspaceRecord(record)] : []
      )),
    };
  }

  private static normalizeWorkspaceRecord(record: {
    workspace?: Partial<WorkspaceDescriptor>;
    updatedAt?: string;
  }): RegisteredWorkspaceRecord {
    return {
      workspace: record.workspace as WorkspaceDescriptor,
      updatedAt: record.updatedAt?.trim() || new Date().toISOString(),
    };
  }

  private static normalizeServer(server: Partial<ControlPlaneServerRecord> | undefined): ControlPlaneServerRecord | undefined {
    if (!server?.serverId || !server.mode || !server.host || typeof server.port !== 'number' || !server.startedAt || !server.lastSeenAt) {
      return undefined;
    }

    return {
      serverId: server.serverId,
      mode: server.mode,
      host: server.host,
      port: server.port,
      pid: typeof server.pid === 'number' ? server.pid : 0,
      startedAt: server.startedAt,
      lastSeenAt: server.lastSeenAt,
    };
  }

  private static normalizeLegacyServer(records: Array<{
    owner?: {
      ownerId?: string;
      mode?: 'daemon';
      host?: string;
      port?: number;
      pid?: number;
      startedAt?: string;
      lastSeenAt?: string;
    };
  }>): ControlPlaneServerRecord | undefined {
    return records
      .map((record) => record.owner)
      .filter((owner): owner is NonNullable<typeof owner> => Boolean(owner))
      .sort((left, right) => (right.lastSeenAt ?? '').localeCompare(left.lastSeenAt ?? ''))
      .flatMap((owner) => RuntimeDaemonRegistryService.normalizeServer({
        serverId: owner.ownerId,
        mode: 'daemon',
        host: owner.host,
        port: owner.port,
        pid: owner.pid,
        startedAt: owner.startedAt,
        lastSeenAt: owner.lastSeenAt,
      }) ?? [])[0];
  }

  private static toRecordMap(records: RegisteredWorkspaceRecord[]): Map<string, RegisteredWorkspaceRecord> {
    return new Map(records.map((record) => [
      RuntimeDaemonRegistryService.workspaceRecordKey(record.workspace),
      record,
    ]));
  }

  private static workspaceRecordKey(workspace: WorkspaceDescriptor): string {
    return resolve(workspace.stateRoot);
  }
}
