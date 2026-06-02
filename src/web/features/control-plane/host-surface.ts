import type { ControlPlaneState } from '../../lib/api';

export type RuntimeHostSurface = {
  state: 'attached' | 'local';
  label: string;
  badgeLabel: string;
  detail: string;
  tone: 'secondary' | 'outline';
  endpoint?: string;
  serverId?: string;
  startedAt?: string;
};

export function projectRuntimeHostSurface(state?: ControlPlaneState): RuntimeHostSurface {
  if (!state?.runtimeHost) {
    return {
      state: 'local',
      label: 'Local control plane',
      badgeLabel: 'Local',
      detail: 'No live server metadata is loaded in this control-plane session.',
      tone: 'outline',
    };
  }

  const endpoint = `${state.runtimeHost.endpoint.host}:${state.runtimeHost.endpoint.port}`;

  return {
    state: 'attached',
    label: 'Attached to control-plane server',
    badgeLabel: 'Server',
    detail: `Sessions and tasks are using the live control-plane server for ${state.workspace.name}.`,
    tone: 'secondary',
    endpoint,
    serverId: state.runtimeHost.serverId,
    startedAt: state.runtimeHost.startedAt,
  };
}
