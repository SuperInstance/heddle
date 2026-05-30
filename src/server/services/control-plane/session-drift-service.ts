import { existsSync, readFileSync } from 'node:fs';
import type { ChatSessionView } from '@/server/control-plane-types.js';
import {
  readObject,
  readString,
} from '@/server/helpers/control-plane-read-values.js';

export class ControlPlaneSessionDriftService {
  static readLatestDriftLevel(turns: unknown[]): ChatSessionView['driftLevel'] {
    for (let index = turns.length - 1; index >= 0; index--) {
      const turn = readObject(turns[index]);
      const traceFile = readString(turn?.traceFile);
      const driftLevel = traceFile ? ControlPlaneSessionDriftService.readLatestDriftLevelFromTrace(traceFile) : undefined;
      if (driftLevel) {
        return driftLevel;
      }
    }

    return undefined;
  }

  private static readLatestDriftLevelFromTrace(traceFile: string): ChatSessionView['driftLevel'] {
    if (!traceFile || !existsSync(traceFile)) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(readFileSync(traceFile, 'utf8')) as unknown;
      if (!Array.isArray(parsed)) {
        return undefined;
      }

      for (let index = parsed.length - 1; index >= 0; index--) {
        const event = readObject(parsed[index]);
        if (event?.type !== 'cyberloop.annotation') {
          continue;
        }

        const driftLevel = readString(event.driftLevel);
        if (driftLevel === 'unknown' || driftLevel === 'low' || driftLevel === 'medium' || driftLevel === 'high') {
          return driftLevel;
        }
      }
    } catch {
      return undefined;
    }

    return undefined;
  }
}
