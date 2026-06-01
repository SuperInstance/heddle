import React, { memo } from 'react';
import { Box, Text } from 'ink';
import type { ControlPlaneSessionDetail, ControlPlaneSessionRuntimeContext } from '@/client-shared/api/types.js';

export const ConversationPanel = memo(function ConversationPanel({
  runtimeContext,
  session,
}: {
  runtimeContext?: ControlPlaneSessionRuntimeContext;
  session: ControlPlaneSessionDetail;
}) {
  const messages = session?.messages.slice(-10) ?? [];
  const showWelcome = Boolean(session && runtimeContext?.welcomeGuide && !session.messages.some((message) => message.role === 'user'));

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold>Conversation</Text>
      {showWelcome && runtimeContext?.welcomeGuide ? <WelcomeGuide runtimeContext={runtimeContext} /> : null}
      {messages.length === 0 && !showWelcome ? <Text dimColor>No messages yet.</Text> : null}
      {messages.map((message, index) => (
        <Box key={message.id} flexDirection="column" marginBottom={1}>
          <Text dimColor>
            {message.role === 'user' ? `┌ You${message.isPending ? ' (queued)' : ''}` : '┌ Heddle'}
          </Text>
          <Box paddingLeft={2} flexDirection="column">
            {message.directShellResult ? (
              <DirectShellResult result={message.directShellResult} />
            ) : (
              message.text.split(/\r?\n/).map((line, lineIndex) => (
                <Text key={`${message.id}-${lineIndex}`} color={message.role === 'user' ? 'cyan' : undefined}>
                  {line || ' '}
                </Text>
              ))
            )}
          </Box>
          <Text dimColor>{index === messages.length - 1 ? '└' : '└────────────────────────────────────────────────────────'}</Text>
        </Box>
      ))}
    </Box>
  );
});

type DirectShellResultView = NonNullable<NonNullable<ControlPlaneSessionDetail>['messages'][number]['directShellResult']>;

function DirectShellResult({ result }: { result: DirectShellResultView }) {
  return (
    <Box flexDirection="column">
      <Text>
        <Text color={result.outcome === 'done' ? 'green' : 'red'}>{result.outcome}</Text>
        <Text dimColor> shell </Text>
        <Text>{result.command}</Text>
      </Text>
      {result.policy?.reason ? <Text dimColor>{result.policy.reason}</Text> : null}
      {result.stdout ? <OutputBlock label="stdout" value={result.stdout} /> : null}
      {result.stderr ? <OutputBlock label="stderr" value={result.stderr} /> : null}
      {result.error ? <OutputBlock label="error" value={result.error} /> : null}
    </Box>
  );
}

function OutputBlock({ label, value }: { label: string; value: string }) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor>{label}</Text>
      {value.split(/\r?\n/).map((line, index) => (
        <Text key={`${label}-${index}`}>{line || ' '}</Text>
      ))}
    </Box>
  );
}

function WelcomeGuide({ runtimeContext }: { runtimeContext: ControlPlaneSessionRuntimeContext }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text dimColor>┌ Heddle</Text>
      <Box paddingLeft={2} flexDirection="column">
        <Text>Heddle conversational mode.</Text>
        <Text> </Text>
        <Text>Ask a question about this workspace.</Text>
        {runtimeContext.welcomeGuide.carriesTranscriptAcrossTurns ? (
          <Text>Each turn runs the current agent loop and carries the transcript into the next turn.</Text>
        ) : null}
        {!runtimeContext.welcomeGuide.hasProviderCredential ? (
          <Text color="yellow">No provider credential detected. Use /auth login openai or set a provider API key.</Text>
        ) : null}
      </Box>
      <Text dimColor>└────────────────────────────────────────────────────────</Text>
    </Box>
  );
}
