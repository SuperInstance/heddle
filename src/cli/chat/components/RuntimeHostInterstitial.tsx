import React from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { ResolvedRuntimeHost } from '@/core/runtime/daemon/index.js';

export function RuntimeHostInterstitial({
  runtimeHost,
}: {
  runtimeHost: Extract<ResolvedRuntimeHost, { kind: 'server' }>;
}) {
  const { exit } = useApp();
  const endpoint = `http://${runtimeHost.endpoint.host}:${runtimeHost.endpoint.port}`;

  useInput((input) => {
    const normalized = input.toLowerCase();
    if (normalized === 'q' || normalized === 'x' || normalized === '\u0003') {
      exit();
      return;
    }

    if (normalized === 'o') {
      process.stdout.write(`Open the control plane at ${endpoint}\n`);
      return;
    }

    if (normalized === 'a') {
      process.stdout.write(`Use daemon-backed ask, for example: heddle ask \"inspect this workspace\"\n`);
    }
  });

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text bold>Control-plane server is already running</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>Heddle already has a live local control-plane server.</Text>
        <Text>Interactive chat stays blocked here so this process does not create a competing runtime owner.</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text>server={endpoint}</Text>
        <Text>serverId={runtimeHost.serverId}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text bold>Actions</Text>
        <Text>o  Print the control plane URL</Text>
        <Text>a  Print a daemon-backed ask example</Text>
        <Text>x  Exit</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>To force embedded ownership anyway, rerun with --force-owner-conflict.</Text>
      </Box>
    </Box>
  );
}
