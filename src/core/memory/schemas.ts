import { z } from 'zod';

export class MemorySchemas {
  static readonly candidate = z.object({
    id: z.string().describe('Stable id for a pending durable knowledge candidate.'),
    recordedAt: z.string().describe('ISO timestamp when the candidate was recorded.'),
    status: z.literal('pending').describe('Candidates in the JSONL log are pending until a status event marks them processed.'),
    summary: z.string().describe('Concise durable fact or preference to preserve.'),
    evidence: z.array(z.string()).optional().describe('Short supporting observations.'),
    categoryHint: z.string().optional().describe('Suggested memory category.'),
    importance: z.enum(['low', 'medium', 'high']).optional().describe('Expected future value.'),
    confidence: z.enum(['user-stated', 'tool-verified', 'inferred', 'historical']).optional().describe('Why the candidate should be trusted.'),
    sourceRefs: z.array(z.string()).optional().describe('Workspace-relative paths, commands, trace ids, or note references.'),
  });

  static readonly candidateStatus = z.object({
    kind: z.literal('candidate_status').describe('Discriminator for candidate status events in the candidate JSONL log.'),
    candidateId: z.string().describe('Candidate id whose status changed.'),
    status: z.literal('processed').describe('Processed candidates are hidden from pending reads.'),
    runId: z.string().describe('Maintenance run that processed the candidate.'),
    recordedAt: z.string().describe('ISO timestamp when the status event was recorded.'),
  });

  static readonly candidateLogEntry = z.union([
    MemorySchemas.candidate,
    MemorySchemas.candidateStatus,
  ]);

  static readonly maintenanceRun = z.object({
    id: z.string().describe('Stable id for a memory maintenance run.'),
    startedAt: z.string().describe('ISO timestamp when the run started.'),
    finishedAt: z.string().describe('ISO timestamp when the run finished.'),
    source: z.string().describe('Caller or workflow that triggered the run.'),
    outcome: z.enum(['done', 'max_steps', 'error', 'interrupted', 'skipped']).describe('Agent-loop or maintenance outcome.'),
    summary: z.string().describe('Human-readable run result summary.'),
    candidateIds: z.array(z.string()).describe('All candidate ids considered by the run.'),
    processedCandidateIds: z.array(z.string()).describe('Candidate ids successfully processed.'),
    failedCandidateIds: z.array(z.string()).describe('Candidate ids skipped or not processed.'),
    catalogValid: z.boolean().describe('Whether required memory catalogs existed after the run.'),
    catalogMissing: z.array(z.string()).describe('Missing required catalog paths.'),
  });

  static readonly maintenanceLock = z.object({
    id: z.string().describe('Opaque lock owner id.'),
    pid: z.number().optional().describe('Process id that acquired the lock.'),
    acquiredAt: z.string().describe('ISO timestamp when the lock was acquired.'),
  });

  static parseCandidateLogEntry(value: unknown) {
    return MemorySchemas.candidateLogEntry.safeParse(value);
  }

  static parseMaintenanceRun(value: unknown) {
    return MemorySchemas.maintenanceRun.safeParse(value);
  }

  static parseMaintenanceLock(value: unknown) {
    return MemorySchemas.maintenanceLock.safeParse(value);
  }
}
