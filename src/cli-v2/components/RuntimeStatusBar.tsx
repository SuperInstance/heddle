import React from 'react';
import { Box, Text } from 'ink';
import type { ControlPlaneSessionStoreSnapshot } from '../state/control-plane-session-store.js';
import { RuntimeStatusService } from '../services/status/index.js';

export function RuntimeStatusBar({
  snapshot,
}: {
  snapshot: ControlPlaneSessionStoreSnapshot;
}) {
  return (
    <Box overflow="hidden">
      <Text dimColor wrap="truncate-end">{RuntimeStatusService.build(snapshot)}</Text>
    </Box>
  );
}
