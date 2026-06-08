/**
 * Snail Shell session metadata integration.
 *
 * Annotates ChatSession objects with Symphony identity information for
 * Fleet discovery and routing.
 */

import type { ChatSession } from '@/core/chat/types.js';
import type { SymphonyShellIdentity } from '../types.js';

export function annotateSessionWithSymphonyIdentity(
  session: ChatSession,
  identity: SymphonyShellIdentity,
): ChatSession & { symphony?: { identity: SymphonyShellIdentity } } {
  return {
    ...session,
    // Store identity as a custom extension;
    // Heddle's serialization will preserve it in .heddle/chat-sessions/*.json
    symphony: {
      identity,
    },
  };
}