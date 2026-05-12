export function buildAwarenessDomainSystemContext(): string {
  return `## Situation Awareness Domain

Situation awareness is the agent's current-state orientation layer for the active workspace. It is different from durable memory and different from direct code inspection.

### Purpose

- Use situation awareness to orient quickly on the current workspace and git state before substantial coding, planning, or review work.
- Treat working_environment as a compact current-state summary for repo root, branch, dirty state, and changed-path groups.
- Use it to avoid re-deriving repo-state basics through redundant shell or file inspection.

### Interpretation

- Situation awareness is a map of current workspace state, not proof of code behavior or design intent.
- After using working_environment, follow with read_file or search_files only for task-specific implementation or documentation details.
- Do not keep rediscovering branch, repo-root, or dirty-state facts unless the task needs deeper verification.

### Boundaries

- Situation awareness is strongest for fresh workspace state and current coding context.
- Durable preferences, recurring workflows, and historical operational context belong to Heddle-managed memory, not situation awareness.
- Live file contents and observed command results still win when the task requires exact implementation evidence.
`;
}

export function appendAwarenessDomainSystemContext(systemContext?: string): string {
  const awarenessContext = buildAwarenessDomainSystemContext();
  return systemContext ? `${awarenessContext}\n\n${systemContext}` : awarenessContext;
}
