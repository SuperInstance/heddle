/**
 * Symphony Shell identity builder service.
 *
 * Constructs SymphonyShellIdentity from environment variables or explicit
 * configuration, and generates Fleet node identifiers.
 */

import type { SymphonyShellIdentity, Timbre, Track, FrequencyConfig } from './types.js';

export type IdentityBuildInput = {
  timbre?: Timbre;
  channel?: string;
  group?: string;
  env?: typeof process.env;
};

const DEFAULTS: Pick<SymphonyShellIdentity, 'timbre' | 'frequency'> = {
  timbre: 'builder',
  frequency: {
    cuePollIntervalMs: 30_000,
    registryHeartbeatIntervalMs: 15_000,
    identityBroadcastIntervalMs: 60_000,
  },
};

export class SymphonyIdentityService {
  static build(input?: IdentityBuildInput): SymphonyShellIdentity {
    const env = input?.env ?? process.env;

    const timbre = (input?.timbre ?? env.SNAIL_SHELL_TIMBRE ?? DEFAULTS.timbre) as Timbre;
    const channel = input?.channel ?? env.SNAIL_SHELL_CHANNEL ?? 'symphony-alpha';
    const group = input?.group ?? env.SNAIL_SHELL_GROUP ?? 'all';

    const frequency: FrequencyConfig = {
      cuePollIntervalMs: Number(env.SNAIL_SHELL_CUE_POLL_MS ?? DEFAULTS.frequency.cuePollIntervalMs),
      registryHeartbeatIntervalMs: Number(env.REGISTRY_HEARTBEAT_MS ?? DEFAULTS.frequency.registryHeartbeatIntervalMs),
      identityBroadcastIntervalMs: Number(env.SNAIL_SHELL_BROADCAST_MS ?? DEFAULTS.frequency.identityBroadcastIntervalMs),
    };

    const track: Track = { channel, group };

    return { timbre, track, frequency };
  }

  /**
   * Generate a stable Fleet node ID from the daemon serverId + workspace path.
   *
   * The ID is deterministic for a given server and workspace, allowing Fleet
   * agents to reliably route to specific Heddle nodes.
   */
  static fleetNodeId(serverId: string, workspaceRoot: string): string {
    const workspaceHash = Buffer.from(workspaceRoot).toString('hex').slice(0, 8);
    return `heddle:${serverId}:${workspaceHash}`;
  }
}