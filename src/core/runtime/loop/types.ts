import type { Logger } from 'pino';
import type { ToolApprovalPolicy } from '@/core/approvals/types.js';
import type { RunAgentOptions } from '@/core/agent/index.js';
import type { ChatMessage, LlmAdapter, LlmProvider, LlmUsage, ReasoningEffort } from '@/core/llm/types.js';
import type { RunResult, StopReason, ToolCall, ToolDefinition, TraceEvent } from '@/core/types.js';

export type AgentLoopStatus = 'finished';

export type AgentLoopState = {
  status: AgentLoopStatus;
  runId: string;
  goal: string;
  model: string;
  provider: LlmProvider;
  workspaceRoot: string;
  startedAt: string;
  finishedAt: string;
  outcome: StopReason;
  summary: string;
  usage?: LlmUsage;
  transcript: ChatMessage[];
  trace: TraceEvent[];
};

export type AgentLoopCheckpoint = {
  version: 1;
  runId: string;
  createdAt: string;
  state: AgentLoopState;
};

export type AgentLoopEvent =
  | {
      type: 'loop.started';
      runId: string;
      goal: string;
      model: string;
      provider: LlmProvider;
      workspaceRoot: string;
      resumedFromCheckpoint?: string;
      timestamp: string;
    }
  | {
      type: 'loop.resumed';
      runId: string;
      fromCheckpoint: string;
      priorTraceEvents: number;
      timestamp: string;
    }
  | {
      type: 'assistant.stream';
      runId: string;
      step: number;
      text: string;
      done: boolean;
      timestamp: string;
    }
  | {
      type: 'tool.calling';
      runId: string;
      step: number;
      tool: string;
      toolCallId: string;
      input: unknown;
      requiresApproval: boolean;
      timestamp: string;
    }
  | {
      type: 'tool.completed';
      runId: string;
      step: number;
      tool: string;
      toolCallId: string;
      result: { ok: boolean; output?: unknown; error?: string };
      durationMs: number;
      timestamp: string;
    }
  | {
      type: 'trace';
      runId: string;
      event: TraceEvent;
      timestamp: string;
    }
  | {
      type: 'checkpoint.saved';
      runId: string;
      checkpoint: AgentLoopCheckpoint;
      step: number;
      timestamp: string;
    }
  | {
      type: 'loop.finished';
      runId: string;
      outcome: RunResult['outcome'];
      summary: string;
      usage: RunResult['usage'];
      state: AgentLoopState;
      timestamp: string;
    };

export type RunAgentLoopOptions = {
  goal: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  apiKey?: string;
  maxSteps?: number;
  workspaceRoot?: string;
  stateDir?: string;
  memoryDir?: string;
  searchIgnoreDirs?: string[];
  systemContext?: string;
  history?: ChatMessage[];
  resumeFrom?: AgentLoopState | AgentLoopCheckpoint;
  llm?: LlmAdapter;
  tools?: ToolDefinition[];
  extraTools?: ToolDefinition[];
  includeDefaultTools?: boolean;
  includePlanTool?: boolean;
  logger?: Logger;
  onEvent?: (event: AgentLoopEvent) => void;
  onTraceEvent?: (event: TraceEvent) => void;
  onAssistantStream?: RunAgentOptions['onAssistantStream'];
  approvalPolicies?: ToolApprovalPolicy[];
  approveToolCall?: (call: ToolCall, tool: ToolDefinition) => Promise<{ approved: boolean; reason?: string }>;
  shouldStop?: () => boolean;
  abortSignal?: AbortSignal;
};

export type AgentLoopResult = RunResult & {
  model: string;
  provider: LlmProvider;
  workspaceRoot: string;
  state: AgentLoopState;
};
