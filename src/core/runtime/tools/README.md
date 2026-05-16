# Runtime Tools

Runtime tools own the default tool bundle policy for generic agent execution.

`RuntimeToolService.createDefaultAgentTools(...)` builds the runtime's default
toolkits and host context. Individual tool behavior stays in `src/core/tools`;
this folder only decides which toolkits the generic runtime includes by default.
