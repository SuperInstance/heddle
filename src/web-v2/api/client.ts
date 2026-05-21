import {
  createTRPCProxyClient,
  httpBatchLink,
  httpSubscriptionLink,
  splitLink,
} from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/server/router';

const trpcLinks = [
  splitLink({
    condition: (operation) => operation.type === 'subscription',
    true: httpSubscriptionLink({
      url: '/trpc',
    }),
    false: httpBatchLink({
      url: '/trpc',
    }),
  }),
];

export const trpcReact = createTRPCReact<AppRouter>();

export const trpc = createTRPCProxyClient<AppRouter>({
  links: trpcLinks,
});

export function createControlPlaneTrpcClient() {
  return trpcReact.createClient({
    links: trpcLinks,
  });
}

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
type AsyncIterableValue<T> = T extends AsyncIterable<infer Value> ? Value : T;
export type ControlPlaneState = RouterOutputs['controlPlane']['state'];
export type ControlPlaneSessionDetail = RouterOutputs['controlPlane']['session'];
export type ControlPlaneSessionEventEnvelope = AsyncIterableValue<RouterOutputs['controlPlane']['sessionEvents']>;
export type ControlPlaneSessionMessage = NonNullable<ControlPlaneSessionDetail>['messages'][number];
export type ControlPlaneSessionSendPromptResult = RouterOutputs['controlPlane']['sessionSendPrompt'];

export async function sendControlPlaneSessionPrompt(
  sessionId: string,
  prompt: string,
): Promise<ControlPlaneSessionSendPromptResult> {
  return await trpc.controlPlane.sessionSendPrompt.mutate({ sessionId, prompt });
}
