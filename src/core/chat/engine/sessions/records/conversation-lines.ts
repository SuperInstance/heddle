/**
 * Pure projection from persisted model transcript to visible conversation lines.
 *
 * Keep transcript-to-UI-message semantics here. This class should not know
 * about storage, host state, or session lifecycle policy.
 */
import type { ChatMessage } from '@/core/llm/types.js';
import { ConversationCompactionService } from '@/core/chat/engine/compaction/index.js';
import type { ConversationDirectShellLineResult, ConversationLine } from '@/core/chat/types.js';
import { ConversationDirectShellLineResultSchema } from '@/core/chat/engine/direct-shell/result-schema.js';

export class ConversationLines {
  static fromHistory(history: ChatMessage[]): ConversationLine[] {
    return history.flatMap((message, index) => {
      if (ConversationCompactionService.isCompactedHistorySummary(message)) {
        const archiveRootMatch = message.content.match(/Archive root:\s*(.+)/);
        return [{
          id: `compacted-${index}`,
          role: 'assistant',
          text:
            archiveRootMatch ?
              `Earlier conversation history was summarized and archived. Raw transcript remains available in ${archiveRootMatch[1]}.`
            : 'Earlier conversation history was summarized and archived for longer chats.',
        }];
      }

      if (message.role === 'user' || message.role === 'assistant') {
        if (!message.content.trim()) {
          return [];
        }

        const directShellResult = ConversationLines.readDirectShellResult(message.content);
        if (directShellResult) {
          return [{
            id: `${message.role}-${index}-${directShellResult.command}`,
            role: message.role,
            text: ConversationLines.buildDirectShellFallbackText(directShellResult),
            directShellResult,
          }];
        }

        return [{ id: `${message.role}-${index}-${message.content}`, role: message.role, text: message.content }];
      }

      if (message.role === 'tool') {
        return [];
      }

      return [];
    });
  }

  private static readDirectShellResult(content: string): ConversationDirectShellLineResult | undefined {
    try {
      const parsed = JSON.parse(content) as unknown;
      const directShellResult = ConversationDirectShellLineResultSchema.safeParse(parsed);
      return directShellResult.success ? directShellResult.data : undefined;
    } catch {
      return undefined;
    }
  }

  private static buildDirectShellFallbackText(result: ConversationDirectShellLineResult): string {
    return result.outcome === 'done'
      ? `Direct shell completed: ${result.command}`
      : `Direct shell failed: ${result.command}`;
  }
}
