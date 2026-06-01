import { Box, Text } from 'ink';

export function DirectShellModeHintPanel({ command }: { command: string }) {
  return (
    <Box marginTop={1}>
      <Text color="yellow">Direct shell</Text>
      <Text dimColor> · </Text>
      <Text dimColor>{command ? `runs ${command}` : 'type command after !'}</Text>
    </Box>
  );
}
