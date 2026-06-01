import { useInput, Box, Text } from 'ink';
import type { ControlPlaneSessionDirectShellPreflight } from '@/client-shared/api/types.js';

export function DirectShellConfirmationPanel({
  confirmation,
  onResolve,
}: {
  confirmation: ControlPlaneSessionDirectShellPreflight;
  onResolve: (accepted: boolean) => void;
}) {
  useInput((input) => {
    const normalized = input.toLowerCase();
    if (normalized === 'y') {
      onResolve(true);
    }
    if (normalized === 'n' || normalized === '\u001b') {
      onResolve(false);
    }
  }, { isActive: true });

  return (
    <Box borderStyle="round" borderColor="yellow" flexDirection="column" paddingX={1} marginTop={1}>
      <Text bold color="yellow">Confirm shell command</Text>
      <Text>{confirmation.command}</Text>
      {confirmation.reason ? <Text dimColor>{confirmation.reason}</Text> : null}
      <Text>
        <Text color="cyan">y</Text>
        <Text dimColor> run once · </Text>
        <Text color="cyan">n</Text>
        <Text dimColor> cancel</Text>
      </Text>
    </Box>
  );
}
