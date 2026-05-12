import { describe, expect, it } from 'vitest';
import {
  formatSessionReasoningEffortStatus,
  resolveEffectiveReasoningEffort,
  resolveNewSessionExecutionPreferences,
  resolveStoredSessionExecutionPreferences,
} from '../../../core/chat/engine/sessions/preferences/service.js';

describe('chat session preferences', () => {
  it('resolves stored session preferences with a fallback model', () => {
    expect(resolveStoredSessionExecutionPreferences({
      stored: {
        model: undefined,
        reasoningEffort: 'low',
      },
      defaultModel: 'gpt-5.4',
    })).toEqual({
      model: 'gpt-5.4',
      reasoningEffort: 'low',
    });
  });

  it('inherits the active model and reasoning effort for a new session', () => {
    expect(resolveNewSessionExecutionPreferences({
      defaultModel: 'gpt-5.4',
      inherited: {
        model: 'gpt-5.5',
        reasoningEffort: 'low',
      },
    })).toEqual({
      model: 'gpt-5.5',
      reasoningEffort: 'low',
    });
  });

  it('keeps stored preferences explicit instead of re-resolving them into derived state', () => {
    expect(resolveStoredSessionExecutionPreferences({
      stored: {
        model: 'gpt-5.5',
        reasoningEffort: undefined,
      },
      defaultModel: 'gpt-5.4',
    })).toEqual({
      model: 'gpt-5.5',
      reasoningEffort: undefined,
    });
  });

  it('resolves the effective reasoning effort from explicit or model-default state', () => {
    expect(resolveEffectiveReasoningEffort({
      model: 'gpt-5.4',
      reasoningEffort: undefined,
    })).toBe('medium');
    expect(resolveEffectiveReasoningEffort({
      model: 'gpt-5.4',
      reasoningEffort: 'low',
    })).toBe('low');
  });

  it('formats a shared reasoning-effort status message', () => {
    expect(formatSessionReasoningEffortStatus({
      model: 'gpt-5.4',
      reasoningEffort: undefined,
    })).toContain('Effective effort: medium');
  });
});
