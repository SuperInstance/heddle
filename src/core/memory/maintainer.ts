import { isAbsolute, relative, resolve } from 'node:path';
import { AgentRunService } from '@/core/agent/index.js';
import { createLogger } from '@/core/utils/logger.js';
import { MemoryCatalogService } from './catalog.js';
import { MemoryMaintenanceRepository } from './maintenance-repository.js';
import { MemoryMaintainerPrompt } from './maintainer-prompt.js';
import { createMemoryMaintainerTools } from './maintainer-tools.js';
import type {
  KnowledgeCandidate,
  KnowledgeMaintenanceRunRecord,
  RunKnowledgeMaintenanceOptions,
  RunKnowledgeMaintenanceResult,
} from './types.js';

/**
 * Owns the agent-backed memory maintenance workflow over pending candidates.
 */
export class MemoryMaintenanceService {
  constructor(
    private readonly memoryRoot: string,
    private readonly repository = new MemoryMaintenanceRepository(memoryRoot),
    private readonly catalog = new MemoryCatalogService(memoryRoot),
  ) {}

  async readPendingCandidates(): Promise<KnowledgeCandidate[]> {
    return await this.repository.readPendingCandidates();
  }

  async run(options: Omit<RunKnowledgeMaintenanceOptions, 'memoryRoot'>): Promise<RunKnowledgeMaintenanceResult> {
    const memoryRoot = resolve(this.memoryRoot);
    this.catalog.bootstrap();

    const now = options.now ?? (() => new Date());
    const startedAt = now();
    const runId = options.nextRunId?.() ?? `memory-run-${startedAt.getTime()}`;
    const candidateIds = options.observations.map((candidate) => candidate.id);
    const skippedCandidateIds = options.observations
      .filter((candidate) => !MemoryMaintenanceService.isMaintainerCandidateAllowed(candidate))
      .map((candidate) => candidate.id);
    const observations = options.observations.filter(MemoryMaintenanceService.isMaintainerCandidateAllowed);

    if (observations.length === 0) {
      const validation = this.catalog.validateShape();
      const run = MemoryMaintenanceService.skippedRun({
        runId,
        startedAt,
        finishedAt: now(),
        source: options.source,
        candidateIds,
        skippedCandidateIds,
        catalogValid: validation.ok,
        catalogMissing: validation.missing,
      });
      await this.repository.appendMaintenanceRun(run);
      return { run };
    }

    const rootCatalog = this.catalog.loadRootCatalog().content;
    const result = await AgentRunService.run({
      goal: MemoryMaintainerPrompt.buildMaintenanceGoal(observations),
      llm: options.llm,
      tools: createMemoryMaintainerTools({ memoryRoot }),
      maxSteps: options.maxSteps ?? 40,
      logger: createLogger({ console: false, level: 'silent' }),
      systemContext: MemoryMaintainerPrompt.buildSystemContext(rootCatalog),
    });
    const validation = this.catalog.validateShape();
    const processedCandidateIds = result.outcome === 'done' ? observations.map((candidate) => candidate.id) : [];
    const failedCandidateIds = result.outcome === 'done' ? skippedCandidateIds : candidateIds;
    const run: KnowledgeMaintenanceRunRecord = {
      id: runId,
      startedAt: startedAt.toISOString(),
      finishedAt: now().toISOString(),
      source: options.source,
      outcome: result.outcome,
      summary: result.summary,
      candidateIds,
      processedCandidateIds,
      failedCandidateIds,
      catalogValid: validation.ok,
      catalogMissing: validation.missing,
    };

    await this.repository.appendMaintenanceRun(run);
    if (processedCandidateIds.length > 0) {
      await this.repository.appendCandidateStatusEvents(processedCandidateIds, run.id, now);
    }

    return { run, result };
  }

  async runBacklog(options: Omit<RunKnowledgeMaintenanceOptions, 'memoryRoot' | 'observations'>): Promise<RunKnowledgeMaintenanceResult> {
    return await this.run({
      ...options,
      observations: await this.readPendingCandidates(),
    });
  }

  static isRecordableCandidateText(value: string): boolean {
    return !MemoryMaintenanceService.containsSecretLikeText(value);
  }

  static isSafeSourceRef(value: string, memoryRoot: string): boolean {
    if (value.includes('\0')) {
      return false;
    }

    if (value.startsWith('trace-') || value.startsWith('session-') || value.startsWith('command:')) {
      return true;
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
      return false;
    }

    if (isAbsolute(value)) {
      return false;
    }

    const normalizedSegments = value.replace(/\\/g, '/').split('/');
    if (normalizedSegments.includes('..')) {
      return false;
    }

    const workspaceRoot = resolve(memoryRoot, '..', '..');
    const resolved = resolve(workspaceRoot, value);
    const rel = relative(workspaceRoot, resolved);
    return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
  }

  private static skippedRun(args: {
    runId: string;
    startedAt: Date;
    finishedAt: Date;
    source: string;
    candidateIds: string[];
    skippedCandidateIds: string[];
    catalogValid: boolean;
    catalogMissing: string[];
  }): KnowledgeMaintenanceRunRecord {
    return {
      id: args.runId,
      startedAt: args.startedAt.toISOString(),
      finishedAt: args.finishedAt.toISOString(),
      source: args.source,
      outcome: 'skipped',
      summary:
        args.candidateIds.length === 0 ? 'No pending knowledge candidates.'
        : `Skipped ${args.candidateIds.length} low-value, duplicate, or secret-like memory candidate(s).`,
      candidateIds: args.candidateIds,
      processedCandidateIds: [],
      failedCandidateIds: args.skippedCandidateIds,
      catalogValid: args.catalogValid,
      catalogMissing: args.catalogMissing,
    };
  }

  private static isMaintainerCandidateAllowed(candidate: KnowledgeCandidate): boolean {
    return MemoryMaintenanceService.isRecordableCandidateText([
      candidate.summary,
      ...(candidate.evidence ?? []),
      ...(candidate.sourceRefs ?? []),
    ].join('\n'));
  }

  private static containsSecretLikeText(value: string): boolean {
    const normalized = value.toLowerCase();
    return /\b(api[_ -]?key|password|passwd|private[_ -]?key|access[_ -]?token|refresh[_ -]?token|bearer\s+[a-z0-9._~+/=-]{12,})\b/i.test(value)
      || /\bsecret\s*[:=]\s*\S{8,}/i.test(value)
      || /\bsk-[a-z0-9_-]{12,}\b/i.test(value)
      || normalized.includes('-----begin private key-----')
      || normalized.includes('-----begin rsa private key-----')
      || normalized.includes('-----begin openssh private key-----');
  }
}
