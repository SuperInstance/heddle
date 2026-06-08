/**
 * Snail Shell session introspection RPC methods.
 *
 * Provides read-only access to session metadata for Fleet agents to discover
 * conversation state and Symphony identity information.
 */

import { z } from 'zod';
import { RuntimeWorkspaceService } from '@/core/runtime/workspaces/index.js';
import { FileChatSessionRepository } from '@/core/chat/engine/sessions/repository/file-chat-session-repository.js';
import { join } from 'node:path';
import type { ChatSession } from '@/core/chat/types.js';
import type { SymphonyShellIdentity } from '../types.js';

const sessionGetParamsSchema = z.object({
  sessionId: z.string().min(1),
});

const sessionRuntimeContextParamsSchema = z.object({
  sessionId: z.string().min(1),
});

export class SnailShellSessionMethods {
  constructor(private readonly ctx: { workspaceRoot: string }) {}

  async list(): Promise<{ sessions: Array<{ id: string; name: string; createdAt: string; updatedAt: string; symphony?: { identity: SymphonyShellIdentity } }> }> {
    const context = RuntimeWorkspaceService.resolveContext({
      workspaceRoot: this.ctx.workspaceRoot,
      stateRoot: join(this.ctx.workspaceRoot, '.heddle'),
    });

    const repository = new FileChatSessionRepository({
      sessionStoragePath: join(context.activeWorkspace.stateRoot, 'chat-sessions'),
    });
    const sessions = repository.list();

    return {
      sessions: sessions.map((s: ChatSession & { symphony?: { identity: SymphonyShellIdentity } }) => ({
        id: s.id,
        name: s.name ?? s.id,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        symphony: s.symphony,
      })),
    };
  }

  async get(params: unknown): Promise<{ id: string; name: string; createdAt: string; updatedAt: string; turnCount: number; symphony?: { identity: SymphonyShellIdentity } } | null> {
    const parsed = sessionGetParamsSchema.safeParse(params);
    if (!parsed.success) {
      throw new Error(`Invalid params: ${parsed.error.message}`);
    }

    const context = RuntimeWorkspaceService.resolveContext({
      workspaceRoot: this.ctx.workspaceRoot,
      stateRoot: join(this.ctx.workspaceRoot, '.heddle'),
    });

    const repository = new FileChatSessionRepository({
      sessionStoragePath: join(context.activeWorkspace.stateRoot, 'chat-sessions'),
    });
    const session = repository.read(parsed.data.sessionId);

    if (!session) {
      return null;
    }

    return {
      id: session.id,
      name: session.name ?? session.id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      turnCount: session.lines.filter((l) => l.role === 'assistant').length,
      symphony: (session as ChatSession & { symphony?: { identity: SymphonyShellIdentity } }).symphony,
    };
  }

  async runtimeContext(params: unknown): Promise<{ sessionId: string; model?: string; provider?: string } | null> {
    const parsed = sessionRuntimeContextParamsSchema.safeParse(params);
    if (!parsed.success) {
      throw new Error(`Invalid params: ${parsed.error.message}`);
    }

    const context = RuntimeWorkspaceService.resolveContext({
      workspaceRoot: this.ctx.workspaceRoot,
      stateRoot: join(this.ctx.workspaceRoot, '.heddle'),
    });

    const repository = new FileChatSessionRepository({
      sessionStoragePath: join(context.activeWorkspace.stateRoot, 'chat-sessions'),
    });
    const session = repository.read(parsed.data.sessionId);

    if (!session) {
      return null;
    }

    return {
      sessionId: session.id,
      model: session.model,
      provider: session.provider,
    };
  }
}