import { createTRPCProxyClient } from '@trpc/client';
import type { AppRouter } from '@/server/router.js';
import { ClientSharedApiLinkService } from './links.js';

export type CreateControlPlaneProxyClientOptions = {
  url: string;
  batch?: boolean;
};

/**
 * Non-React API client service for terminal and programmatic consumers.
 *
 * The service owns proxy client construction so CLI, TUI, and ask mode share the
 * same tRPC transport behavior instead of maintaining separate factories.
 */
export class ClientSharedProxyApiService {
  static createClient({
    url,
    batch = true,
  }: CreateControlPlaneProxyClientOptions) {
    return createTRPCProxyClient<AppRouter>({
      links: ClientSharedApiLinkService.create({ url, batch }),
    });
  }
}

export type ControlPlaneProxyClient = ReturnType<typeof ClientSharedProxyApiService.createClient>;
