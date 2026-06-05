import { describe, expect, it } from 'vitest';
import {
  ChatSessionLeases,
  SESSION_LEASE_STALE_AFTER_MS,
} from '../../../core/chat/engine/sessions/leases/index.js';
import type { ChatSession } from '../../../core/chat/types.js';

function createSession(): ChatSession {
  return {
    id: 'session-1',
    name: 'Session 1',
    history: [],
    messages: [],
    turns: [],
    createdAt: '2026-04-21T00:00:00.000Z',
    updatedAt: '2026-04-21T00:00:00.000Z',
    archives: [],
  };
}

describe('chat session leases', () => {
  it('acquires and releases a lease for the same owner', () => {
    const leased = ChatSessionLeases.acquire(createSession(), {
      ownerKind: 'tui',
      ownerId: 'tui-123',
      clientLabel: 'terminal chat',
    }, {
      now: Date.parse('2026-04-21T01:00:00.000Z'),
    });

    expect(leased.lease).toMatchObject({
      ownerKind: 'tui',
      ownerId: 'tui-123',
      clientLabel: 'terminal chat',
    });
    expect(ChatSessionLeases.isFresh(leased.lease, { now: Date.parse('2026-04-21T01:00:19.000Z') })).toBe(true);
    expect(ChatSessionLeases.isFresh(leased.lease, { now: Date.parse('2026-04-21T01:00:21.000Z') })).toBe(false);

    const released = ChatSessionLeases.release(leased, { ownerId: 'tui-123' });
    expect(released.lease).toBeUndefined();
  });

  it('uses a short stale window for crashed control-plane recovery', () => {
    const leased = ChatSessionLeases.acquire(createSession(), {
      ownerKind: 'daemon',
      ownerId: 'embedded-chat-12345-1779894401584',
      clientLabel: 'control plane',
    }, {
      now: Date.parse('2026-04-21T01:00:00.000Z'),
    });

    expect(ChatSessionLeases.conflict(leased, {
      ownerKind: 'daemon',
      ownerId: 'embedded-chat-99999-1779894500000',
      clientLabel: 'control plane',
    }, {
      now: Date.parse('2026-04-21T01:00:00.000Z') + SESSION_LEASE_STALE_AFTER_MS - 1,
    })).toContain('already active in control plane');

    expect(ChatSessionLeases.conflict(leased, {
      ownerKind: 'daemon',
      ownerId: 'embedded-chat-99999-1779894500000',
      clientLabel: 'control plane',
    }, {
      now: Date.parse('2026-04-21T01:00:00.000Z') + SESSION_LEASE_STALE_AFTER_MS + 1,
    })).toBeUndefined();
  });

  it('refreshes lastSeenAt only for the matching owner', () => {
    const leased = ChatSessionLeases.acquire(createSession(), {
      ownerKind: 'daemon',
      ownerId: 'daemon-123',
      clientLabel: 'control plane',
    }, {
      now: Date.parse('2026-04-21T01:00:00.000Z'),
    });

    const ignored = ChatSessionLeases.refresh(leased, { ownerId: 'daemon-other' }, {
      now: Date.parse('2026-04-21T01:00:05.000Z'),
    });
    expect(ignored.lease?.lastSeenAt).toBe('2026-04-21T01:00:00.000Z');

    const refreshed = ChatSessionLeases.refresh(leased, { ownerId: 'daemon-123' }, {
      now: Date.parse('2026-04-21T01:00:05.000Z'),
    });
    expect(refreshed.lease?.lastSeenAt).toBe('2026-04-21T01:00:05.000Z');
    expect(refreshed.lease?.acquiredAt).toBe('2026-04-21T01:00:00.000Z');
  });

  it('reports a conflict for a different fresh owner', () => {
    const leased = ChatSessionLeases.acquire(createSession(), {
      ownerKind: 'daemon',
      ownerId: 'daemon-1',
      clientLabel: 'control plane',
    }, {
      now: Date.parse('2026-04-21T01:00:00.000Z'),
    });

    expect(ChatSessionLeases.conflict(leased, {
      ownerKind: 'tui',
      ownerId: 'tui-123',
      clientLabel: 'terminal chat',
    }, {
      now: Date.parse('2026-04-21T01:00:10.000Z'),
    })).toContain('Continuing from multiple clients in the same session may corrupt the conversation.');
  });

  it('ignores stale leases', () => {
    const leased = ChatSessionLeases.acquire(createSession(), {
      ownerKind: 'ask',
      ownerId: 'ask-123',
      clientLabel: 'heddle ask',
    }, {
      now: Date.parse('2026-04-21T01:00:00.000Z'),
    });

    expect(ChatSessionLeases.conflict(leased, {
      ownerKind: 'tui',
      ownerId: 'tui-123',
      clientLabel: 'terminal chat',
    }, {
      now: Date.parse('2026-04-21T01:20:00.000Z'),
    })).toBeUndefined();
  });

  it('ignores fresh leases owned by dead local Heddle processes', () => {
    const leased = ChatSessionLeases.acquire(createSession(), {
      ownerKind: 'tui',
      ownerId: 'tui-4686',
      clientLabel: 'terminal chat',
    }, {
      now: Date.parse('2026-04-21T01:00:00.000Z'),
    });

    expect(ChatSessionLeases.isOwnedByDeadLocalProcess(leased.lease, { isProcessAlive: () => false })).toBe(true);
    expect(ChatSessionLeases.conflict(leased, {
      ownerKind: 'tui',
      ownerId: 'tui-123',
      clientLabel: 'terminal chat',
    }, {
      now: Date.parse('2026-04-21T01:01:00.000Z'),
      isProcessAlive: () => false,
    })).toBeUndefined();
  });

  it('recognizes restarted daemon leases as dead local process leases', () => {
    const leased = ChatSessionLeases.acquire(createSession(), {
      ownerKind: 'daemon',
      ownerId: 'daemon-4686-1779894401584',
      clientLabel: 'control plane',
    }, {
      now: Date.parse('2026-04-21T01:00:00.000Z'),
    });

    expect(ChatSessionLeases.isOwnedByDeadLocalProcess(leased.lease, { isProcessAlive: () => false })).toBe(true);
    expect(ChatSessionLeases.conflict(leased, {
      ownerKind: 'daemon',
      ownerId: 'daemon-9999-1779894500000',
      clientLabel: 'control plane',
    }, {
      now: Date.parse('2026-04-21T01:01:00.000Z'),
      isProcessAlive: () => false,
    })).toBeUndefined();
  });

  it('still reports fresh local process leases when the owner is alive', () => {
    const leased = ChatSessionLeases.acquire(createSession(), {
      ownerKind: 'tui',
      ownerId: 'tui-4686',
      clientLabel: 'terminal chat',
    }, {
      now: Date.parse('2026-04-21T01:00:00.000Z'),
    });

    expect(ChatSessionLeases.conflict(leased, {
      ownerKind: 'tui',
      ownerId: 'tui-123',
      clientLabel: 'terminal chat',
    }, {
      now: Date.parse('2026-04-21T01:00:10.000Z'),
      isProcessAlive: () => true,
    })).toContain('already active in terminal chat');
  });
});
