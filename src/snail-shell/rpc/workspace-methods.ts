/**
 * Snail Shell workspace introspection RPC methods.
 *
 * Provides Fleet agents with workspace listing, status, and change tracking
 * capabilities for multi-workspace coordination.
 */

import { z } from 'zod';
import { RuntimeWorkspaceService } from '@/core/runtime/workspaces/index.js';
import { join } from 'node:path';

const workspaceStatusParamsSchema = z.object({
  workspaceId: z.string().min(1).optional(),
});

const workspaceChangesParamsSchema = z.object({
  workspaceId: z.string().min(1).optional(),
});

export class SnailShellWorkspaceMethods {
  constructor(private readonly ctx: { workspaceRoot: string }) {}

  list() {
    const context = RuntimeWorkspaceService.resolveContext({
      workspaceRoot: this.ctx.workspaceRoot,
      stateRoot: join(this.ctx.workspaceRoot, '.heddle'),
    });

    return {
      activeWorkspaceId: context.activeWorkspaceId,
      workspaces: context.workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        workspaceRoot: w.workspaceRoot,
        stateRoot: w.stateRoot,
        repoRoots: w.repoRoots,
      })),
    };
  }

  async status(params: unknown): Promise<{ workspaceId: string; name: string; workspaceRoot: string; stateRoot: string } | null> {
    const parsed = workspaceStatusParamsSchema.safeParse(params);
    if (!parsed.success) {
      throw new Error(`Invalid params: ${parsed.error.message}`);
    }

    const context = RuntimeWorkspaceService.resolveContext({
      workspaceRoot: this.ctx.workspaceRoot,
      stateRoot: join(this.ctx.workspaceRoot, '.heddle'),
    });

    const active = parsed.data.workspaceId
      ? context.workspaces.find((w) => w.id === parsed.data.workspaceId)
      : context.activeWorkspace;

    if (!active) {
      return null;
    }

    return {
      workspaceId: active.id,
      name: active.name,
      workspaceRoot: active.workspaceRoot,
      stateRoot: active.stateRoot,
    };
  }

  async changes(params: unknown): Promise<{ workspaceId: string; hasChanges: boolean }> {
    const parsed = workspaceChangesParamsSchema.safeParse(params);
    if (!parsed.success) {
      throw new Error(`Invalid params: ${parsed.error.message}`);
    }

    const context = RuntimeWorkspaceService.resolveContext({
      workspaceRoot: this.ctx.workspaceRoot,
      stateRoot: join(this.ctx.workspaceRoot, '.heddle'),
    });

    const active = parsed.data.workspaceId
      ? context.workspaces.find((w) => w.id === parsed.data.workspaceId)
      : context.activeWorkspace;

    if (!active) {
      throw new Error('Workspace not found');
    }

    // TODO: Implement git status checking via ControlPlaneWorkspaceDiffController
    // For now, return placeholder
    return {
      workspaceId: active.id,
      hasChanges: false,
    };
  }
}