import { useCallback, useRef, useState } from 'react';
import { ClientSharedPromptInputService } from '@/client-shared/services/prompt-input/index.js';
import type {
  ClientSharedPromptDraftState,
  ClientSharedPromptHistoryDirection,
  ClientSharedPromptHistoryState,
} from '@/client-shared/services/prompt-input/index.js';

export function usePromptDraft() {
  const initialDraftState = { value: '', cursor: 0 };
  const [draftState, setDraftStateValue] = useState<ClientSharedPromptDraftState>(initialDraftState);
  const [historyState, setHistoryState] = useState<ClientSharedPromptHistoryState>({ entries: [] });
  const draftStateRef = useRef<ClientSharedPromptDraftState>(initialDraftState);
  const undoRedoStateRef = useRef(ClientSharedPromptInputService.clearUndoRedo());

  const applyDraftState = useCallback((nextState: ClientSharedPromptDraftState, options: { recordUndo: boolean }) => {
    const normalized = {
      value: nextState.value,
      cursor: ClientSharedPromptInputService.clampCursor(nextState.value, nextState.cursor),
    };

    if (options.recordUndo) {
      const nextUndoRedo = ClientSharedPromptInputService.recordUndoState(
        undoRedoStateRef.current,
        draftStateRef.current,
        normalized,
      );
      undoRedoStateRef.current = nextUndoRedo;
    }

    draftStateRef.current = normalized;
    setDraftStateValue(normalized);
  }, []);

  const setDraftState = useCallback((nextState: ClientSharedPromptDraftState) => {
    applyDraftState(nextState, { recordUndo: true });
    setHistoryState((current) => ({
      entries: current.entries,
      index: undefined,
      savedDraft: undefined,
    }));
  }, [applyDraftState]);

  const setDraft = useCallback((value: string) => {
    setDraftState({ value, cursor: value.length });
  }, [setDraftState]);

  const clearDraft = useCallback(() => {
    const clearedUndoRedo = ClientSharedPromptInputService.clearUndoRedo();
    undoRedoStateRef.current = clearedUndoRedo;
    applyDraftState({ value: '', cursor: 0 }, { recordUndo: false });
  }, [applyDraftState]);

  const recordSubmittedPrompt = useCallback((value: string) => {
    setHistoryState((current) => ClientSharedPromptInputService.recordPrompt(current, value));
  }, []);

  const navigateHistory = useCallback((direction: ClientSharedPromptHistoryDirection) => {
    const next = ClientSharedPromptInputService.navigateHistory({
      state: historyState,
      currentDraft: draftState,
      direction,
    });
    if (!next) {
      return;
    }

    setHistoryState(next.history);
    const clearedUndoRedo = ClientSharedPromptInputService.clearUndoRedo();
    undoRedoStateRef.current = clearedUndoRedo;
    applyDraftState(next.draft, { recordUndo: false });
  }, [applyDraftState, draftState, historyState]);

  const undoPromptEdit = useCallback(() => {
    const next = ClientSharedPromptInputService.undoPromptEdit(undoRedoStateRef.current, draftStateRef.current);
    if (!next) {
      return;
    }

    undoRedoStateRef.current = next.history;
    applyDraftState(next.draft, { recordUndo: false });
  }, [applyDraftState]);

  const redoPromptEdit = useCallback(() => {
    const next = ClientSharedPromptInputService.redoPromptEdit(undoRedoStateRef.current, draftStateRef.current);
    if (!next) {
      return;
    }

    undoRedoStateRef.current = next.history;
    applyDraftState(next.draft, { recordUndo: false });
  }, [applyDraftState]);

  return {
    draft: draftState.value,
    cursor: draftState.cursor,
    setDraft,
    setDraftState,
    clearDraft,
    recordSubmittedPrompt,
    navigateHistory,
    undoPromptEdit,
    redoPromptEdit,
  };
}
