# Direct Shell

This folder owns conversation-level direct shell behavior for `!command`.

`src/core/tools/toolkits/shell-process/` owns shell execution policy:
classification, inspect/mutate capability, catastrophic blocking, timeouts, and
the raw tool result shape.

This direct-shell service owns the chat-session meaning of a user running a
shell command directly:

- persist the visible `!command` user message;
- expose preflight facts that say whether the command is safe, blocked, or
  requires host-side confirmation;
- execute the preflight-selected inspect or mutate shell tool after confirmation
  has already been handled by the interface;
- publish shared live activity facts for web-v2 and cli-v2;
- persist a direct-shell result message into session history;
- compact/update session context through the chat engine.

Interfaces must not classify commands with local regexes or run shell commands
locally. They own only the confirmation UX for `confirmRequired` preflight
results. Agent-originated tool approval remains in `src/core/approvals/`; direct
shell confirmation is user-originated and must not create remembered project
approval rules.
