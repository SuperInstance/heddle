import type { KnowledgeCandidate } from './types.js';

/**
 * Owns the memory maintainer prompt text.
 *
 * Keep static instructions before dynamic catalog/candidate content so model
 * providers can reuse token cache across maintenance runs.
 */
export class MemoryMaintainerPrompt {
  private static readonly staticSystemContext = `## Memory Maintainer Mode

You maintain Heddle workspace memory. You are not doing general coding work.
Use only memory tools. Do not ask for shell, code edit, web, or external tools.

### Hard Invariants

- Every durable note must be discoverable through the root catalog or a folder catalog.
- Read the root catalog first, then read the relevant folder catalog before writing.
- Search existing notes before creating a new note.
- Prefer updating existing notes over creating duplicates.
- Update folder catalogs whenever you create, rename, or retire a note.
- Update the root catalog only when a new high-value note or discovery path matters globally.
- Do not store secrets, credentials, private keys, tokens, or passwords.
- Skip low-value, duplicate, speculative, or one-turn scratch observations.`;

  static buildSystemContext(rootCatalog: string): string {
    return `${MemoryMaintainerPrompt.staticSystemContext}

## Loaded Root Catalog

${rootCatalog}`;
  }

  static buildMaintenanceGoal(observations: KnowledgeCandidate[]): string {
    return `# Memory Maintenance Task

Process these pending memory candidates into maintained cataloged memory.

${MemoryMaintainerPrompt.formatCandidates(observations)}

End with a concise summary of what memory notes or catalogs changed, or why candidates were skipped.`;
  }

  private static formatCandidates(observations: KnowledgeCandidate[]): string {
    return observations
      .map((candidate, index) => {
        const evidence = candidate.evidence?.length
          ? `\n\n### Evidence\n\n${candidate.evidence.map((item) => `- ${item}`).join('\n')}`
          : '';
        const sourceRefs = candidate.sourceRefs?.length
          ? `\n\n### Source Refs\n\n${candidate.sourceRefs.map((ref) => `- ${ref}`).join('\n')}`
          : '';
        const categoryHint = candidate.categoryHint ? `\n- Category hint: ${candidate.categoryHint}` : '';
        const importance = candidate.importance ? `\n- Importance: ${candidate.importance}` : '';
        const confidence = candidate.confidence ? `\n- Confidence: ${candidate.confidence}` : '';

        return `## Candidate ${index + 1}: ${candidate.id}

- Summary: ${candidate.summary}${categoryHint}${importance}${confidence}${evidence}${sourceRefs}`;
      })
      .join('\n\n');
  }
}
