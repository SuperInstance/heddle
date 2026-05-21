import { trpcReact, type ControlPlaneState } from '@web/api/client';

type ControlPlaneSidebarData = {
  sessions: ControlPlaneState['sessions'];
  tasks: ControlPlaneState['heartbeat']['tasks'];
  loading: boolean;
  error?: string;
};

// useControlPlaneSidebarData keeps the v2 sidebar wired to the server-owned
// control-plane view shape. Mock data should not live below this boundary.
export function useControlPlaneSidebarData(): ControlPlaneSidebarData {
  const stateQuery = trpcReact.controlPlane.state.useQuery();

  const fallbackState: ControlPlaneSidebarData = {
    sessions: [],
    tasks: [],
    loading: true,
  };

  return {
    sessions: stateQuery.data?.sessions ?? fallbackState.sessions,
    tasks: stateQuery.data?.heartbeat.tasks ?? fallbackState.tasks,
    loading: stateQuery.isLoading || stateQuery.isFetching,
    error: stateQuery.error instanceof Error ? stateQuery.error.message : undefined,
  };
}
