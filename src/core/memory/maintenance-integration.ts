import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { TraceEvent } from '@/core/types.js';
import { MemoryMaintenanceRepository } from './maintenance-repository.js';
import { MemoryMaintenanceService } from './maintainer.js';
import type {
  RunMaintenanceForRecordedCandidatesOptions,
  RunMaintenanceForRecordedCandidatesResult,
} from './types.js';

const DEFAULT_LOCK_STALE_AFTER_MS = 10 * 60 * 1000;
const DEFAULT_LOCK_POLL_MS = 250;
const DEFAULT_LOCK_TIMEOUT_MS = 30 * 1000;
const maintenanceQueues = new Map<string, Promise<void>>();

/**
 * Bridges turn traces into serialized memory maintenance runs.
 */
export class MemoryMaintenanceIntegrationService {
  constructor(
    private readonly memoryRoot: string,
    private readonly repository = new MemoryMaintenanceRepository(memoryRoot),
    private readonly maintenance = new MemoryMaintenanceService(memoryRoot, repository),
  ) {}

  async runForRecordedCandidates(
    options: Omit<RunMaintenanceForRecordedCandidatesOptions, 'memoryRoot'>,
  ): Promise<RunMaintenanceForRecordedCandidatesResult> {
    return await this.enqueue(() => this.runNow(options));
  }

  private async runNow(
    options: Omit<RunMaintenanceForRecordedCandidatesOptions, 'memoryRoot'>,
  ): Promise<RunMaintenanceForRecordedCandidatesResult> {
    const candidateIds = MemoryMaintenanceIntegrationService.candidateIdsFromTrace(options.trace);
    if (candidateIds.length === 0) {
      return { candidateIds, events: [] };
    }

    const pending = await this.repository.readPendingCandidates();
    const observations = pending.filter((candidate) => candidateIds.includes(candidate.id));
    if (observations.length === 0) {
      return { candidateIds, events: [] };
    }

    const runId = `memory-run-${Date.now()}`;
    const started = MemoryMaintenanceIntegrationService.createEvent({
      type: 'memory.maintenance_started',
      runId,
      candidateIds: observations.map((candidate) => candidate.id),
      step: MemoryMaintenanceIntegrationService.nextMemoryStep(options.trace),
    });
    options.onTraceEvent?.(started);

    let lock: { release: () => Promise<void> } | undefined;
    try {
      lock = await this.acquireLock({
        staleAfterMs: options.lockStaleAfterMs,
        timeoutMs: options.lockTimeoutMs,
      });
      const maintenance = await this.maintenance.run({
        observations,
        llm: options.llm,
        source: options.source,
        maxSteps: options.maxSteps,
        nextRunId: () => runId,
      });
      if (maintenance.run.outcome === 'error' || maintenance.run.outcome === 'max_steps' || maintenance.run.outcome === 'interrupted') {
        const failed = MemoryMaintenanceIntegrationService.createEvent({
          type: 'memory.maintenance_failed',
          runId: maintenance.run.id,
          error: maintenance.run.summary,
          candidateIds: observations.map((candidate) => candidate.id),
          step: MemoryMaintenanceIntegrationService.nextMemoryStep(options.trace),
        });
        options.onTraceEvent?.(failed);
        return { candidateIds, maintenance, events: [started, failed] };
      }

      const finished = MemoryMaintenanceIntegrationService.createEvent({
        type: 'memory.maintenance_finished',
        runId: maintenance.run.id,
        outcome: maintenance.run.outcome,
        summary: maintenance.run.summary,
        processedCandidateIds: maintenance.run.processedCandidateIds,
        failedCandidateIds: maintenance.run.failedCandidateIds,
        step: MemoryMaintenanceIntegrationService.nextMemoryStep(options.trace),
      });
      options.onTraceEvent?.(finished);
      return { candidateIds, maintenance, events: [started, finished] };
    } catch (error) {
      const failed = MemoryMaintenanceIntegrationService.createEvent({
        type: 'memory.maintenance_failed',
        runId,
        error: error instanceof Error ? error.message : String(error),
        candidateIds: observations.map((candidate) => candidate.id),
        step: MemoryMaintenanceIntegrationService.nextMemoryStep(options.trace),
      });
      options.onTraceEvent?.(failed);
      return { candidateIds, events: [started, failed] };
    } finally {
      await lock?.release();
    }
  }

  private async acquireLock(options: {
    staleAfterMs?: number;
    timeoutMs?: number;
  }): Promise<{ release: () => Promise<void> }> {
    const lockPath = this.repository.maintenanceLockPath();
    const lockId = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const startedAt = Date.now();
    const timeoutMs = options.timeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
    const staleAfterMs = options.staleAfterMs ?? DEFAULT_LOCK_STALE_AFTER_MS;
    await mkdir(dirname(lockPath), { recursive: true });

    while (true) {
      try {
        await this.repository.writeLock(lockPath, {
          id: lockId,
          pid: process.pid,
          acquiredAt: new Date().toISOString(),
        });

        return {
          release: async () => {
            await this.releaseLock(lockPath, lockId);
          },
        };
      } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') {
          throw error;
        }

        if (await this.removeStaleLock(lockPath, staleAfterMs)) {
          continue;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          throw new Error(`Memory maintenance lock is busy: ${lockPath}`, { cause: error });
        }
        await MemoryMaintenanceIntegrationService.sleep(DEFAULT_LOCK_POLL_MS);
      }
    }
  }

  private async releaseLock(lockPath: string, lockId: string) {
    const current = await this.repository.readLock(lockPath);
    if (current?.id !== lockId) {
      return;
    }
    await this.repository.removeLock(lockPath);
  }

  private async removeStaleLock(lockPath: string, staleAfterMs: number): Promise<boolean> {
    const current = await this.repository.readLock(lockPath);
    if (!current) {
      return false;
    }

    const acquiredAt = Date.parse(current.acquiredAt);
    if (!Number.isFinite(acquiredAt) || Date.now() - acquiredAt < staleAfterMs) {
      return false;
    }

    await this.repository.removeLock(lockPath);
    return true;
  }

  private async enqueue<T>(run: () => Promise<T>): Promise<T> {
    const memoryRoot = resolve(this.memoryRoot);
    const previous = maintenanceQueues.get(memoryRoot) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolvePromise) => {
      release = resolvePromise;
    });
    const queued = previous.then(() => current, () => current);
    maintenanceQueues.set(memoryRoot, queued);

    await previous.catch(() => undefined);
    try {
      return await run();
    } finally {
      release();
      if (maintenanceQueues.get(memoryRoot) === queued) {
        maintenanceQueues.delete(memoryRoot);
      }
    }
  }

  private static candidateIdsFromTrace(trace: TraceEvent[]): string[] {
    return [...new Set(trace
      .filter((event): event is Extract<TraceEvent, { type: 'memory.candidate_recorded' }> => event.type === 'memory.candidate_recorded')
      .map((event) => event.candidateId))];
  }

  private static createEvent<T extends Omit<TraceEvent, 'timestamp'> & { type: TraceEvent['type'] }>(event: T): T & { timestamp: string } {
    return {
      ...event,
      timestamp: new Date().toISOString(),
    };
  }

  private static nextMemoryStep(trace: TraceEvent[]): number {
    return trace.reduce((max, event) => 'step' in event ? Math.max(max, event.step) : max, 0) + 1;
  }

  private static async sleep(ms: number): Promise<void> {
    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, ms));
  }
}
