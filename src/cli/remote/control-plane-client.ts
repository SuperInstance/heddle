import type { ResolvedRuntimeHost } from '@/core/runtime/daemon/index.js';
import { ClientSharedProxyApiService } from '@/client-shared/api/proxy.js';

export function createDaemonControlPlaneClient(host: Extract<ResolvedRuntimeHost, { kind: 'server' }>) {
  return ClientSharedProxyApiService.createClient({
    url: `http://${host.endpoint.host}:${host.endpoint.port}/trpc`,
  });
}
