/**
 * Snail Shell Fleet communication RPC methods.
 *
 * Implements Fleet-specific methods: t-minus cue handling, identity publishing,
 * and health checks for Fleet orchestration.
 */

import { z } from 'zod';
import type { SymphonyShellIdentity } from '../types.js';
import { SymphonyIdentityService } from '../identity.js';
import { RuntimeWorkspaceService } from '@/core/runtime/workspaces/index.js';
import { join } from 'node:path';

const tMinusParamsSchema = z.object({
  target: z.enum(['session.send-prompt', 'heartbeat.run-tasks', 'memory.maintain', 'fleet.status']),
  sessionId: z.string().optional(),
  prompt: z.string().optional(),
  workspaceId: z.string().optional(),
  sender: z.string(),
  timestamp: z.string(),
});

export class SnailShellFleetMethods {
  private readonly identity: SymphonyShellIdentity;
  private readonly workspaceRoot: string;

  constructor(options: { identity: SymphonyShellIdentity; workspaceRoot: string }) {
    this.identity = options.identity;
    this.workspaceRoot = options.workspaceRoot;
  }

  getIdentity(): { identity: SymphonyShellIdentity; fleetNodeId: string } {
    return {
      identity: this.identity,
      fleetNodeId: SymphonyIdentityService.fleetNodeId(
        `snail-${process.pid}`,
        this.workspaceRoot,
      ),
    };
  }

  getHealth(): {
    status: 'healthy' | 'degraded';
    uptime: number;
    workspaceCount: number;
    sessionCount: number;
    memory: { rss: number; heapUsed: number; heapTotal: number };
  } {
    const context = RuntimeWorkspaceService.resolveContext({
      workspaceRoot: this.workspaceRoot,
      stateRoot: join(this.workspaceRoot, '.heddle'),
    });

    const memUsage = process.memoryUsage();

    return {
      status: 'healthy',
      uptime: process.uptime(),
      workspaceCount: context.workspaces.length,
      sessionCount: 0,
      memory: {
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
      },
    };
  }

  async handleTMinus(params: unknown): Promise<{ accepted: boolean; reason?: string }> {
    const parsed = tMinusParamsSchema.safeParse(params);
    if (!parsed.success) {
      throw new Error(`Invalid params: ${parsed.error.message}`);
    }

    const { timestamp } = parsed.data;

    // Validate cue freshness (reject cues older than 60s)
    const cueTime = new Date(timestamp).getTime();
    if (Date.now() - cueTime > 60_000) {
      return { accepted: false, reason: 'cue stale' };
    }

    // TODO: Route to internal controller
    // For MVP: write cue to .heddle/snail-shell/cues/ for the cue loop to pick up
    return { accepted: true };
  }
}