/**
 * Snail Shell types for Symphony Shell identity embedding.
 *
 * These types define the metadata that identifies a Heddle node within the
 * Fleet orchestration system.
 */

/** Symphony Shell identity — embedded in every session and runtime host. */
export type SymphonyShellIdentity = {
  /** The role/tone of this Heddle node ("builder", "auditor", "weaver", "watcher"). */
  timbre: Timbre;

  /** The Fleet channel(s) this node participates in. */
  track: Track;

  /** Poll cadence & heartbeat frequency configuration. */
  frequency: FrequencyConfig;
};

/** Agent role/tone identifier for Fleet routing. */
export type Timbre = 'builder' | 'auditor' | 'weaver' | 'watcher';

/** Fleet channel membership and routing information. */
export type Track = {
  /** Fleet channel this node listens on (e.g. "symphony-alpha", "fleet-canary"). */
  channel: string;

  /** Group/tag for Fleet routing (e.g. "lucid", "cyberloop", "all"). */
  group: string;
};

/** Poll cadence & heartbeat frequency configuration. */
export type FrequencyConfig = {
  /** How often (ms) this node checks for t-minus cues. */
  cuePollIntervalMs: number;

  /** How often (ms) the daemon heartbeats to the workspace registry. */
  registryHeartbeatIntervalMs: number;

  /** How often (ms) the node publishes identity state to Fleet. */
  identityBroadcastIntervalMs: number;
};