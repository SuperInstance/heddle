/**
 * Snail Shell public API exports.
 *
 * Provides types and services for Symphony Shell identity embedding,
 * Fleet communication, and daemon integration.
 */

export type {
  SymphonyShellIdentity,
  Timbre,
  Track,
  FrequencyConfig,
} from './types.js';

export { SymphonyIdentityService } from './identity.js';
export type { IdentityBuildInput } from './identity.js';