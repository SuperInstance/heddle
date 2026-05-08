import { memo } from 'react';

import type { ChatSessionDetail } from '../../../lib/api';
import { className } from '../utils';
import { Pill } from './common';
import { AssistantMarkdown } from './AssistantMarkdown';

type ChatMessage = Exclude<ChatSessionDetail, null>['messages'][number];

type ParsedToolResult = {
  tool: string;
  ok?: boolean;
  command?: string;
  output?: unknown;
  error?: string;
};

export const ConversationMessage = memo(function ConversationMessage({ message }: { message: ChatMessage }) {
  const isWorking = message.role === 'assistant' && Boolean(message.isPending || message.isStreaming);
  const toolResult = message.role === 'assistant' ? parseToolResultMessage(message.text) : undefined;

  if (message.role === 'user') {
    return <UserConversationMessage message={message} />;
  }

  if (toolResult) {
    return <ToolResultMessage message={message} result={toolResult} isWorking={isWorking} />;
  }

  const variant = classifyAssistantMessage(message);
  return <AssistantConversationMessage message={message} variant={variant} isWorking={isWorking} />;
});

function UserConversationMessage({ message }: { message: ChatMessage }) {
  return (
    <article className="message-row user" data-message-role="user">
      <div className="message user-message-card">
        <div className="message-header user-message-header">
          <span>You</span>
        </div>
        <div className="message-body user-message-body">{message.text}</div>
      </div>
    </article>
  );
}

function AssistantConversationMessage({
  message,
  variant,
  isWorking,
}: {
  message: ChatMessage;
  variant: 'article' | 'status';
  isWorking: boolean;
}) {
  if (variant === 'status') {
    return (
      <article className="message-row assistant status" data-message-role="assistant" data-message-variant="status">
        <div className={className('message assistant-status-card', isWorking && 'working')}>
          <div className="message-header assistant-status-header">
            <span>Heddle</span>
            <div className="pills compact-pills">
              {message.isPending ? <Pill tone="warn">working</Pill> : null}
              {message.isStreaming ? <Pill>live</Pill> : null}
            </div>
          </div>
          <div className="message-body assistant-status-body">{message.text}</div>
        </div>
      </article>
    );
  }

  return (
    <article className="message-row assistant article" data-message-role="assistant" data-message-variant="article">
      <div className="assistant-article-shell">
        <div className="message-header assistant-article-header">
          <span>Heddle</span>
          <div className="pills compact-pills">
            {message.isPending ? <Pill tone="warn">working</Pill> : null}
            {message.isStreaming ? <Pill>live</Pill> : null}
          </div>
        </div>
        <div className={className('message-body assistant-article-body', isWorking && 'working')}>
          <AssistantMarkdown markdown={message.text} />
        </div>
      </div>
    </article>
  );
}

function ToolResultMessage({
  message,
  result,
  isWorking,
}: {
  message: ChatMessage;
  result: ParsedToolResult;
  isWorking: boolean;
}) {
  return (
    <article className="message-row assistant tool-result" data-message-role="assistant" data-message-variant="tool-result">
      <div className={className('message tool-result-card', isWorking && 'working')}>
        <div className="message-header tool-result-header">
          <span>Tool result</span>
          <div className="pills compact-pills">
            <Pill tone={result.ok === false ? 'bad' : 'good'}>{result.tool}</Pill>
            {message.isPending ? <Pill tone="warn">working</Pill> : null}
            {message.isStreaming ? <Pill>live</Pill> : null}
          </div>
        </div>
        <div className="message-body tool-result-message-body">
          <ToolResultBody result={result} />
        </div>
      </div>
    </article>
  );
}

function ToolResultBody({ result }: { result: ParsedToolResult }) {
  const output = formatToolOutput(result.output);
  return (
    <div className="tool-result-body">
      <div className="tool-result-meta">
        <Pill tone={result.ok === false ? 'bad' : 'good'}>{result.ok === false ? 'failed' : 'completed'}</Pill>
        {result.command ? <span className="tool-command">{result.command}</span> : null}
      </div>
      {result.error ? <p className="tool-error">{result.error}</p> : null}
      {output ? <pre className="tool-output">{output}</pre> : <p className="muted">No visible output.</p>}
    </div>
  );
}

function classifyAssistantMessage(message: ChatMessage): 'article' | 'status' {
  if (message.id.startsWith('live-run-status')) {
    return 'status';
  }

  const trimmed = message.text.trim();
  if (!trimmed) {
    return 'status';
  }

  if (isShortStatusText(trimmed)) {
    return 'status';
  }

  return 'article';
}

function isShortStatusText(text: string): boolean {
  if (text.length > 120) {
    return false;
  }

  return [
    /^run started/i,
    /^working…/i,
    /^approval /i,
    /^fallback:/i,
    /^memory update/i,
    /^memory updating/i,
    /^compaction /i,
    /^heddle is working/i,
    /^[a-z_][a-z0-9_]* finished(?: in \d+ms)?$/i,
  ].some((pattern) => pattern.test(text));
}

function parseToolResultMessage(text: string): ParsedToolResult | undefined {
  const match = text.match(/^([a-z][a-z0-9_]*):\s*([\s\S]*)$/);
  if (!match) {
    return undefined;
  }

  const [, tool, rawPayload] = match;
  if (!isKnownToolName(tool)) {
    return undefined;
  }

  const payload = parseJsonPayload(rawPayload.trim());
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { tool, output: rawPayload.trim() };
  }

  const record = payload as Record<string, unknown>;
  const output = record.output;
  const outputRecord = output && typeof output === 'object' && !Array.isArray(output) ? output as Record<string, unknown> : undefined;
  return {
    tool,
    ok: typeof record.ok === 'boolean' ? record.ok : undefined,
    command: typeof outputRecord?.command === 'string' ? outputRecord.command : undefined,
    output: outputRecord?.stdout ?? outputRecord?.output ?? output,
    error: typeof record.error === 'string' ? record.error : typeof outputRecord?.stderr === 'string' && !outputRecord.stdout ? outputRecord.stderr : undefined,
  };
}

function parseJsonPayload(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function formatToolOutput(output: unknown): string | undefined {
  if (output === undefined || output === null) {
    return undefined;
  }

  if (typeof output === 'string') {
    return output.trim() || undefined;
  }

  return JSON.stringify(output, null, 2);
}

function isKnownToolName(value: string): boolean {
  return [
    'edit_file',
    'edit_memory_note',
    'list_files',
    'read_file',
    'report_state',
    'run_shell_inspect',
    'run_shell_mutate',
    'search_files',
    'search_memory_notes',
    'update_plan',
    'view_image',
    'web_search',
  ].includes(value);
}
