import {
  httpBatchLink,
  httpLink,
  httpSubscriptionLink,
  splitLink,
  type TRPCLink,
} from '@trpc/client';
import type { AppRouter } from '@/server/router.js';

export type CreateControlPlaneTrpcLinksOptions = {
  url: string;
  batch?: boolean;
};

/**
 * Shared tRPC link service for frontend API consumers.
 *
 * Owns the transport split between subscriptions and request/response calls so
 * web-v2, TUI, and CLI callers do not each rebuild link policy.
 */
export class ClientSharedApiLinkService {
  static create({
    url,
    batch = false,
  }: CreateControlPlaneTrpcLinksOptions): TRPCLink<AppRouter>[] {
    const requestLink = batch ? httpBatchLink({ url }) : httpLink({ url });

    return [
      splitLink({
        condition: (operation) => operation.type === 'subscription',
        true: httpSubscriptionLink({ url }),
        false: requestLink,
      }),
    ];
  }
}
