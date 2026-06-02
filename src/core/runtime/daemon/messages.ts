/**
 * Runtime host message formatter.
 *
 * Keeps live control-plane server notices and conflict text together so host
 * adapters do not each invent slightly different wording for the same runtime
 * state.
 */
import type { ResolvedRuntimeHost } from './types.js';

export class RuntimeHostMessages {
  static formatNotice(command: string, host: ResolvedRuntimeHost): string | undefined {
    if (host.kind !== 'server' || host.stale) {
      return undefined;
    }

    if (command === 'chat') {
      return [
        'Heddle notice: a live control-plane server is running.',
        `server=http://${host.endpoint.host}:${host.endpoint.port}`,
        'Embedded chat still works here; avoid writing to the same session from multiple clients.',
      ].join(' ');
    }

    return [
      `Heddle notice: a live control-plane server is running for \`${command}\`.`,
      `server=http://${host.endpoint.host}:${host.endpoint.port}`,
    ].join(' ');
  }

  static embeddedCommandConflict(command: string, host: ResolvedRuntimeHost): string | undefined {
    if (host.kind !== 'server' || host.stale) {
      return undefined;
    }

    return [
      'A live Heddle control-plane server is already running.',
      `Refusing embedded \`${command}\` to avoid conflicting runtime owners.`,
      `server=http://${host.endpoint.host}:${host.endpoint.port}`,
      'Use the daemon-backed control plane, stop the daemon, or rerun with `--force-owner-conflict`.',
    ].join(' ');
  }

  static daemonStartConflict(host: ResolvedRuntimeHost): string | undefined {
    if (host.kind !== 'server' || host.stale) {
      return undefined;
    }

    return [
      'A live Heddle control-plane server is already running.',
      'Refusing to start a second daemon.',
      `server=http://${host.endpoint.host}:${host.endpoint.port}`,
      'Stop the existing daemon first or rerun with `--force-owner-conflict`.',
    ].join(' ');
  }
}
