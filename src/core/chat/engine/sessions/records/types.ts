import type { ReasoningEffort } from '@/core/llm/types.js';
import type { ChatSessionRetention } from '@/core/chat/types.js';

export type CreateChatSessionRecordOptions = {
  id: string;
  name: string;
  apiKeyPresent: boolean;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  workspaceId?: string;
  retention?: ChatSessionRetention;
};

export type GenerateChatSessionTitleInput = {
  prompt: string;
  responseText: string;
  normalize: (value: string | undefined) => string | undefined;
};
