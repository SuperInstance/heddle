/**
 * Snail Shell Fleet cue loop.
 *
 * Background interval that polls for t-minus cues (Fleet orchestration signals)
 * and executes matched actions. In Phase 1, checks local cue directory.
 */

import type { SymphonyShellIdentity } from '../types.js';
import { mkdirSync, readdirSync, readFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

type TMinusCue = {
  type: 't-minus';
  target: 'session.send-prompt' | 'heartbeat.run-tasks' | 'memory.maintain' | 'fleet.status';
  payload?: Record<string, unknown>;
  sender: string;
  timestamp: string;
};

export class SnailShellFleetCueLoop {
  private timer: NodeJS.Timeout | null = null;
  private readonly pollIntervalMs: number;
  private readonly cueDir: string;

  constructor(
    private readonly options: {
      identity: SymphonyShellIdentity;
      workspaceRoot: string;
      stateRoot: string;
      cuePollIntervalMs: number;
    },
  ) {
    this.pollIntervalMs = options.cuePollIntervalMs;
    this.cueDir = resolve(options.stateRoot, 'snail-shell', 'cues');

    // Ensure cue directory exists
    mkdirSync(this.cueDir, { recursive: true });
  }

  start(): void {
    if (this.timer) return;

    this.timer = setInterval(() => this.pollForCues(), this.pollIntervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async pollForCues(): Promise<void> {
    try {
      if (!existsSync(this.cueDir)) {
        return;
      }

      const entries = readdirSync(this.cueDir, { withFileTypes: true });
      const cueFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.json'));

      for (const cueFile of cueFiles) {
        const cuePath = resolve(this.cueDir, cueFile.name);
        await this.processCue(cuePath);
      }
    } catch (error: unknown) {
      // Log error but don't crash the loop
      console.error('Error polling for cues:', error instanceof Error ? error.message : String(error));
    }
  }

  private async processCue(cuePath: string): Promise<void> {
    try {
      const content = readFileSync(cuePath, 'utf-8');
      const cue: TMinusCue = JSON.parse(content);

      // Validate cue freshness
      const cueTime = new Date(cue.timestamp).getTime();
      if (Date.now() - cueTime > 60_000) {
        // Stale cue, just delete it
        unlinkSync(cuePath);
        return;
      }

      // Execute matched cues
      // TODO: Implement action routing based on cue.target
      // For now, just log and delete
      console.log(`Received cue: ${cue.target} from ${cue.sender}`);

      unlinkSync(cuePath);
    } catch (error: unknown) {
      // Log error and delete malformed cue
      console.error('Error processing cue:', error instanceof Error ? error.message : String(error));
      try {
        unlinkSync(cuePath);
      } catch {
        // Ignore delete errors
      }
    }
  }
}