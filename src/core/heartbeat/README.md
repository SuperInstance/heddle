# Heartbeat

Heartbeat owns bounded autonomous wake cycles.

This domain sits beside `src/core/runtime` instead of inside it. Runtime owns the
generic agent-loop host API; heartbeat owns scheduled/background task semantics,
checkpoint reuse, task/run persistence, scheduler state projection, and
operator-facing heartbeat views.

## Owns

- `heartbeat.ts`: single heartbeat wake execution on top of `AgentLoopRuntimeService.run`.
- `heartbeat-store.ts`: checkpoint-backed one-off heartbeat execution.
- `heartbeat-task-store.ts`: durable heartbeat task/checkpoint/run storage.
- `heartbeat-scheduler.ts`: due-task selection and scheduler loop.
- `heartbeat-task-state.ts`: heartbeat task state projection after success or
  failure.
- `heartbeat-views.ts`: task/run view projection for host surfaces.
- `heartbeat-lucid.ts`: Lucid-facing heartbeat status/progress projection.

## Does Not Own

- Generic runtime events, agent-loop checkpoints, or default tool assembly. Those
  stay in `src/core/runtime`.
- Interactive chat sessions, conversation turns, compaction, or session
  persistence. Those stay in `src/core/chat`.
- CLI, server, web, or TUI presentation. Those surfaces should call this domain
  through typed heartbeat entry points.

## Boundary Notes

- Keep scheduler/task persistence concerns here, not in runtime.
- Heartbeat may depend on runtime's public `AgentLoopRuntimeService.run` and checkpoint types.
  Runtime should not import heartbeat.
- When this domain is refactored further, follow the `src/core/chat/engine`
  pattern: class-backed owning services/repositories, local `types.ts` contracts,
  schema-owned persistence validation, and no compatibility wrappers.
