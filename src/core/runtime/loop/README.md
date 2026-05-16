# Runtime Loop

The loop subdomain owns one evented agent execution without persisted chat
session semantics.

`AgentLoopRuntimeService.run(...)` is the main entry point. It resolves the
model/provider/runtime credentials, builds default tools when requested, emits
host-facing loop events, calls `AgentRunService.run(...)`, and returns the final
checkpointable loop state.

Use `AgentLoopCheckpointService` for state/checkpoint conversion and resume
history extraction. Do not put chat sessions, heartbeat scheduling, or host UI
logic in this folder.
