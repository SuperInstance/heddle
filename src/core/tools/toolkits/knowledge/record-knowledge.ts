import { resolve } from 'node:path';
import { MemoryMaintenanceRepository } from '@/core/memory/maintenance-repository.js';
import { MemoryMaintenanceService } from '@/core/memory/maintainer.js';
import type { KnowledgeCandidate } from '@/core/memory/types.js';
import type { ToolDefinition, ToolResult } from '../../../types.js';

export type RecordKnowledgeToolOptions = {
  memoryRoot?: string;
  now?: () => Date;
  nextId?: () => string;
};

type RecordKnowledgeInput = Omit<KnowledgeCandidate, 'id' | 'recordedAt' | 'status'>;

type RecordKnowledgeCandidate = {
  summary: string;
  evidence?: string[];
  categoryHint?: string;
  importance?: 'low' | 'medium' | 'high';
  confidence?: 'user-stated' | 'tool-verified' | 'inferred' | 'historical';
  sourceRefs?: string[];
};

const DEFAULT_MEMORY_ROOT = resolve(process.cwd(), '.heddle', 'memory');
const MAX_SUMMARY_LENGTH = 2000;
const MAX_EVIDENCE_ITEMS = 8;
const MAX_SOURCE_REFS = 12;
const MAX_TEXT_FIELD_LENGTH = 1000;

export function createRecordKnowledgeTool(options: RecordKnowledgeToolOptions = {}): ToolDefinition {
  return {
    name: 'record_knowledge',
    description:
      'Submit a durable memory candidate for later cataloged maintenance. Prefer memory_checkpoint before final answers when it is available; use this lower-level append tool only when you already know a durable candidate should be recorded. Good candidates include canonical verification commands, project-specific workflow steps, user/team preferences, verified commands, architectural findings, workflows, incidents, repeated session patterns, service relationships, operational facts, or durable repo constraints likely to save future rediscovery. This does not directly edit memory notes; it records a candidate under .heddle/memory/_maintenance for a maintainer pass. Required: summary. Optional: evidence[], categoryHint, importance ("low"|"medium"|"high"), confidence ("user-stated"|"tool-verified"|"inferred"|"historical"), sourceRefs[]. Do not submit secrets, credentials, tokens, private keys, or one-turn scratch notes.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        summary: {
          type: 'string',
          description: 'Concise durable fact or preference to preserve',
        },
        evidence: {
          type: 'array',
          items: { type: 'string' },
          description: 'Short evidence snippets or observations supporting the summary',
        },
        categoryHint: {
          type: 'string',
          description: 'Suggested memory category, such as current-state, workflows, preferences, domain, operations, relationships, or history',
        },
        importance: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Expected future value of this memory candidate',
        },
        confidence: {
          type: 'string',
          enum: ['user-stated', 'tool-verified', 'inferred', 'historical'],
          description: 'Why the candidate should be trusted',
        },
        sourceRefs: {
          type: 'array',
          items: { type: 'string' },
          description: 'Workspace-relative file paths, commands, trace ids, or note references that support the candidate',
        },
      },
      required: ['summary'],
    },
    async execute(raw: unknown): Promise<ToolResult> {
      const memoryRoot = resolveMemoryRoot(options);
      const parsed = RecordKnowledgeToolInput.validate(raw, memoryRoot);
      if (!parsed.ok) {
        return { ok: false, error: parsed.error };
      }

      const now = options.now?.() ?? new Date();
      const record = {
        id: options.nextId?.() ?? `candidate-${now.getTime()}`,
        recordedAt: now.toISOString(),
        status: 'pending',
        ...parsed.input,
      } satisfies KnowledgeCandidate;

      await new MemoryMaintenanceRepository(memoryRoot).appendCandidate(record);

      return {
        ok: true,
        output: {
          id: record.id,
          path: '_maintenance/candidates.jsonl',
          status: record.status,
          message: 'Knowledge candidate recorded for memory maintenance.',
        },
      };
    },
  };
}

export const recordKnowledgeTool = createRecordKnowledgeTool();

class RecordKnowledgeToolInput {
  static validate(
    raw: unknown,
    memoryRoot: string,
  ): { ok: true; input: RecordKnowledgeInput } | { ok: false; error: string } {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, error: RecordKnowledgeToolInput.invalidInputMessage() };
    }

    const input = raw as Record<string, unknown>;
    const allowedKeys = new Set(['summary', 'evidence', 'categoryHint', 'importance', 'confidence', 'sourceRefs']);
    if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
      return { ok: false, error: RecordKnowledgeToolInput.invalidInputMessage() };
    }

    if (typeof input.summary !== 'string' || !input.summary.trim() || input.summary.length > MAX_SUMMARY_LENGTH) {
      return { ok: false, error: `Invalid input for record_knowledge. Required field summary must be a non-empty string up to ${MAX_SUMMARY_LENGTH} characters.` };
    }

    const summary = input.summary.trim();
    if (!MemoryMaintenanceService.isRecordableCandidateText(summary)) {
      return { ok: false, error: 'record_knowledge refused secret-like content in summary. Do not store credentials, tokens, private keys, or passwords in memory.' };
    }

    const evidence = RecordKnowledgeToolInput.validateOptionalStringArray(input.evidence, 'evidence', MAX_EVIDENCE_ITEMS);
    if (!evidence.ok) {
      return { ok: false, error: evidence.error };
    }
    if (evidence.values.some((value) => !MemoryMaintenanceService.isRecordableCandidateText(value))) {
      return { ok: false, error: 'record_knowledge refused secret-like content in evidence. Do not store credentials, tokens, private keys, or passwords in memory.' };
    }

    const sourceRefs = RecordKnowledgeToolInput.validateOptionalStringArray(input.sourceRefs, 'sourceRefs', MAX_SOURCE_REFS);
    if (!sourceRefs.ok) {
      return { ok: false, error: sourceRefs.error };
    }
    const invalidSourceRef = sourceRefs.values.find((sourceRef) => !MemoryMaintenanceService.isSafeSourceRef(sourceRef, memoryRoot));
    if (invalidSourceRef) {
      return { ok: false, error: `record_knowledge sourceRefs must be workspace-relative paths or non-path references. Refusing unsafe sourceRef: ${invalidSourceRef}` };
    }
    if (sourceRefs.values.some((value) => !MemoryMaintenanceService.isRecordableCandidateText(value))) {
      return { ok: false, error: 'record_knowledge refused secret-like content in sourceRefs. Do not store credentials, tokens, private keys, or passwords in memory.' };
    }

    if (input.categoryHint !== undefined && (typeof input.categoryHint !== 'string' || !input.categoryHint.trim() || input.categoryHint.length > 80)) {
      return { ok: false, error: 'Invalid input for record_knowledge. Optional field categoryHint must be a non-empty string up to 80 characters.' };
    }

    if (input.importance !== undefined && input.importance !== 'low' && input.importance !== 'medium' && input.importance !== 'high') {
      return { ok: false, error: 'Invalid input for record_knowledge. Optional field importance must be one of: low, medium, high.' };
    }

    if (
      input.confidence !== undefined
      && input.confidence !== 'user-stated'
      && input.confidence !== 'tool-verified'
      && input.confidence !== 'inferred'
      && input.confidence !== 'historical'
    ) {
      return { ok: false, error: 'Invalid input for record_knowledge. Optional field confidence must be one of: user-stated, tool-verified, inferred, historical.' };
    }

    return {
      ok: true,
      input: {
        summary,
        evidence: evidence.values.length > 0 ? evidence.values : undefined,
        categoryHint: typeof input.categoryHint === 'string' ? input.categoryHint.trim() : undefined,
        importance: input.importance as RecordKnowledgeCandidate['importance'] | undefined,
        confidence: input.confidence as RecordKnowledgeCandidate['confidence'] | undefined,
        sourceRefs: sourceRefs.values.length > 0 ? sourceRefs.values : undefined,
      },
    };
  }

  private static validateOptionalStringArray(
    raw: unknown,
    field: string,
    maxItems: number,
  ): { ok: true; values: string[] } | { ok: false; error: string } {
    if (raw === undefined) {
      return { ok: true, values: [] };
    }
    if (!Array.isArray(raw) || raw.length > maxItems || raw.some((value) => typeof value !== 'string' || !value.trim() || value.length > MAX_TEXT_FIELD_LENGTH)) {
      return { ok: false, error: `Invalid input for record_knowledge. Optional field ${field} must be an array of up to ${maxItems} non-empty strings, each up to ${MAX_TEXT_FIELD_LENGTH} characters.` };
    }
    return { ok: true, values: raw.map((value) => value.trim()) };
  }

  private static invalidInputMessage(): string {
    return 'Invalid input for record_knowledge. Required field: summary. Optional fields: evidence, categoryHint, importance, confidence, sourceRefs.';
  }
}

function resolveMemoryRoot(options: RecordKnowledgeToolOptions): string {
  return resolve(options.memoryRoot ?? DEFAULT_MEMORY_ROOT);
}
