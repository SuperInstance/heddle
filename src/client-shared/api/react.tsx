import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/router.js';
import { ClientSharedApiLinkService } from './links.js';

export type CreateClientSharedReactApiClientOptions = {
  url?: string;
};

/**
 * React API client service for web-facing React surfaces.
 *
 * Owns the typed tRPC React object and client construction while keeping
 * AppRouter type usage inside the shared client boundary.
 */
export class ClientSharedReactApiService {
  static readonly trpcReact = createTRPCReact<AppRouter>();

  static createClient(options: CreateClientSharedReactApiClientOptions = {}) {
    return ClientSharedReactApiService.trpcReact.createClient({
      links: ClientSharedApiLinkService.create({
        url: options.url ?? '/trpc',
      }),
    });
  }
}

export const trpcReact = ClientSharedReactApiService.trpcReact;
