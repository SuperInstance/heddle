import { randomUUID } from 'node:crypto';
import type {
  ToolApprovalRequest,
  ToolApprovalUserDecision,
} from '@/core/approvals/index.js';
import { SESSION_LEASE_REFRESH_INTERVAL_MS } from '@/core/chat/engine/sessions/leases/index.js';
import type { ControlPlaneAcceptedSessionRun } from '@/server/control-plane-types.js';

export type ControlPlaneSessionRunAddress = {
  workspaceId: string;
  sessionId: string;
};

export type PendingControlPlaneApproval = {
  approval: ToolApprovalRequest;
  resolve: (decision: ToolApprovalUserDecision) => void;
};

export type ControlPlaneSessionRunContext = {
  runId: string;
  acceptedAt: string;
  controller: AbortController;
};

type StartControlPlaneSessionRunInput<Result> = {
  address: ControlPlaneSessionRunAddress;
  onAccepted?: (run: ControlPlaneSessionRunContext) => void;
  onHeartbeat?: (run: ControlPlaneSessionRunContext) => void | Promise<void>;
  execute: (run: ControlPlaneSessionRunContext) => Promise<Result>;
  onError?: (error: unknown, run: ControlPlaneSessionRunContext) => void | Promise<void>;
  onSettled?: (run: ControlPlaneSessionRunContext) => void | Promise<void>;
};

type InFlightControlPlaneRun<Result = unknown> = ControlPlaneSessionRunContext & {
  result: Promise<Result>;
};

/**
 * Owns control-plane run coordination for session-scoped long-running work.
 *
 * Core chat services own persisted conversation semantics. This service owns
 * process-local runtime coordination: in-flight runs, abort controllers,
 * approval resolvers, and the async-start vs wait-for-result split.
 */
export class ControlPlaneSessionRunService {
  private readonly pendingApprovals = new Map<string, PendingControlPlaneApproval>();
  private readonly inFlightRuns = new Map<string, InFlightControlPlaneRun>();

  start<Result>(input: StartControlPlaneSessionRunInput<Result>): ControlPlaneAcceptedSessionRun {
    const key = ControlPlaneSessionRunService.addressKey(input.address);
    if (this.inFlightRuns.has(key)) {
      throw new Error('A run is already in progress for this session.');
    }

    const run: Omit<InFlightControlPlaneRun<Result>, 'result'> = {
      runId: `session-run-${randomUUID()}`,
      acceptedAt: new Date().toISOString(),
      controller: new AbortController(),
    };

    let accepted = false;
    let acceptanceError: unknown;
    let stopHeartbeat: (() => void) | undefined;

    const result = Promise.resolve()
      .then(() => {
        if (!accepted) {
          throw acceptanceError ?? new Error(`Accepted run never started: ${run.runId}`);
        }

        return input.execute(run);
      })
      .catch(async (error: unknown) => {
        if (accepted) {
          await input.onError?.(error, run);
        }
        throw error;
      })
      .finally(() => {
        stopHeartbeat?.();
        this.pendingApprovals.delete(key);
        this.inFlightRuns.delete(key);
        if (accepted) {
          void Promise.resolve(input.onSettled?.(run)).catch(() => undefined);
        }
      });

    this.inFlightRuns.set(key, { ...run, result });
    result.catch(() => undefined);

    try {
      input.onAccepted?.(run);
      stopHeartbeat = this.startHeartbeat(run, input.onHeartbeat);
      accepted = true;
    } catch (error) {
      acceptanceError = error;
      this.pendingApprovals.delete(key);
      this.inFlightRuns.delete(key);
      throw error;
    }

    return {
      accepted: true,
      workspaceId: input.address.workspaceId,
      sessionId: input.address.sessionId,
      runId: run.runId,
      acceptedAt: run.acceptedAt,
    };
  }

  async startAndWait<Result>(input: StartControlPlaneSessionRunInput<Result>): Promise<Result> {
    const accepted = this.start(input);
    if (!('accepted' in accepted)) {
      throw new Error(`Expected accepted run for ${input.address.sessionId}.`);
    }
    return await this.requireRun<Result>(input.address, accepted.runId).result;
  }

  isRunning(address: ControlPlaneSessionRunAddress): boolean {
    return this.inFlightRuns.has(ControlPlaneSessionRunService.addressKey(address));
  }

  cancelRun(address: ControlPlaneSessionRunAddress): boolean {
    const key = ControlPlaneSessionRunService.addressKey(address);
    const run = this.inFlightRuns.get(key);
    if (!run) {
      return false;
    }

    run.controller.abort();
    const pending = this.pendingApprovals.get(key);
    if (pending) {
      this.pendingApprovals.delete(key);
      pending.resolve({
        type: 'deny',
        reason: 'Cancelled by user',
      });
    }
    return true;
  }

  getPendingApproval(address: ControlPlaneSessionRunAddress): ToolApprovalRequest | undefined {
    return this.pendingApprovals.get(ControlPlaneSessionRunService.addressKey(address))?.approval;
  }

  storePendingApproval(address: ControlPlaneSessionRunAddress, pending: PendingControlPlaneApproval): void {
    this.pendingApprovals.set(ControlPlaneSessionRunService.addressKey(address), pending);
  }

  clearPendingApproval(address: ControlPlaneSessionRunAddress): void {
    this.pendingApprovals.delete(ControlPlaneSessionRunService.addressKey(address));
  }

  resolvePendingApproval(
    address: ControlPlaneSessionRunAddress,
    decision: ToolApprovalUserDecision,
  ): boolean {
    const key = ControlPlaneSessionRunService.addressKey(address);
    const pending = this.pendingApprovals.get(key);
    if (!pending) {
      return false;
    }

    this.pendingApprovals.delete(key);
    pending.resolve(decision);
    return true;
  }

  private requireRun<Result>(address: ControlPlaneSessionRunAddress, runId: string): InFlightControlPlaneRun<Result> {
    const run = this.inFlightRuns.get(ControlPlaneSessionRunService.addressKey(address));
    if (!run || run.runId !== runId) {
      throw new Error(`Accepted run is no longer active: ${runId}`);
    }

    return run as InFlightControlPlaneRun<Result>;
  }

  private static addressKey(address: ControlPlaneSessionRunAddress): string {
    return `${address.workspaceId}:${address.sessionId}`;
  }

  private startHeartbeat(
    run: ControlPlaneSessionRunContext,
    onHeartbeat: StartControlPlaneSessionRunInput<unknown>['onHeartbeat'],
  ): (() => void) | undefined {
    if (!onHeartbeat) {
      return undefined;
    }

    let refreshing = false;
    const timer = setInterval(() => {
      if (refreshing || run.controller.signal.aborted) {
        return;
      }

      refreshing = true;
      Promise.resolve()
        .then(() => onHeartbeat(run))
        .catch(() => {
          run.controller.abort();
        })
        .finally(() => {
          refreshing = false;
        });
    }, SESSION_LEASE_REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }
}
