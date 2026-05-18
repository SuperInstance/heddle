import type { LlmAdapter } from '@/core/llm/types.js';
import type { RunResult, TraceEvent } from '@/core/types.js';

export type MemoryCategory = {
  path: string;
  title: string;
  purpose: string;
  readWhen: string;
};

export type BootstrapMemoryWorkspaceResult = {
  memoryRoot: string;
  createdPaths: string[];
};

export type MemoryCatalogLoadResult = {
  memoryRoot: string;
  catalogPath: string;
  exists: boolean;
  content: string;
  truncated: boolean;
  originalBytes: number;
  maxBytes: number;
};

export type MemoryCatalogShapeValidation = {
  ok: boolean;
  memoryRoot: string;
  missing: string[];
};

export type KnowledgeCandidate = {
  id: string;
  recordedAt: string;
  status: 'pending';
  summary: string;
  evidence?: string[];
  categoryHint?: string;
  importance?: 'low' | 'medium' | 'high';
  confidence?: 'user-stated' | 'tool-verified' | 'inferred' | 'historical';
  sourceRefs?: string[];
};

export type KnowledgeCandidateStatusRecord = {
  kind: 'candidate_status';
  candidateId: string;
  status: 'processed';
  runId: string;
  recordedAt: string;
};

export type KnowledgeMaintenanceRunRecord = {
  id: string;
  startedAt: string;
  finishedAt: string;
  source: string;
  outcome: RunResult['outcome'] | 'skipped';
  summary: string;
  candidateIds: string[];
  processedCandidateIds: string[];
  failedCandidateIds: string[];
  catalogValid: boolean;
  catalogMissing: string[];
};

export type RunKnowledgeMaintenanceOptions = {
  memoryRoot: string;
  observations: KnowledgeCandidate[];
  llm: LlmAdapter;
  source: string;
  maxSteps?: number;
  now?: () => Date;
  nextRunId?: () => string;
};

export type RunKnowledgeMaintenanceResult = {
  run: KnowledgeMaintenanceRunRecord;
  result?: RunResult;
};

export type RunMaintenanceForRecordedCandidatesOptions = {
  memoryRoot: string;
  llm: LlmAdapter;
  source: string;
  trace: TraceEvent[];
  maxSteps?: number;
  lockTimeoutMs?: number;
  lockStaleAfterMs?: number;
  onTraceEvent?: (event: TraceEvent) => void;
};

export type RunMaintenanceForRecordedCandidatesResult = {
  candidateIds: string[];
  maintenance?: RunKnowledgeMaintenanceResult;
  events: TraceEvent[];
};

export type MemoryStatusView = {
  memoryRoot: string;
  catalog: {
    ok: boolean;
    missing: string[];
  };
  notes: {
    count: number;
  };
  candidates: {
    pending: number;
  };
  runs: {
    latest: KnowledgeMaintenanceRunRecord[];
  };
};

export type MemoryValidationIssue =
  | {
    type: 'missing_catalog';
    severity: 'error';
    path: string;
    message: string;
  }
  | {
    type: 'oversized_catalog';
    severity: 'warning';
    path: string;
    sizeBytes: number;
    maxBytes: number;
    message: string;
  }
  | {
    type: 'orphan_note';
    severity: 'warning';
    path: string;
    message: string;
  }
  | {
    type: 'pending_candidates';
    severity: 'info';
    count: number;
    message: string;
  };

export type MemoryValidationResult = {
  memoryRoot: string;
  ok: boolean;
  issueCount: number;
  issues: MemoryValidationIssue[];
};

export type ListMemoryNotesInput = {
  path?: string;
};

export type ReadMemoryNoteInput = {
  path: string;
  maxLines?: number;
  offset?: number;
};

export type SearchMemoryNotesInput = {
  query: string;
  path?: string;
  maxResults?: number;
};

export type MemoryMaintenanceLockRecord = {
  id: string;
  pid?: number;
  acquiredAt: string;
};
