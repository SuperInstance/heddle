import type { ReactNode } from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp, Check, ChevronDown, Plus, Search } from 'lucide-react';
import type { ControlPlaneModelOptions } from '@web/api/client';
import { Button } from '@web/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@web/components/ui/popover';
import { Textarea } from '@web/components/ui/textarea';
import type { ControlPlaneReasoningEffortSelection } from '@web/hooks/sessions/useControlPlaneSessionDetail';
import type { I18nMessageKey } from '@web/i18n';
import { useI18n } from '@web/i18n';
import { cn } from '@web/lib/utils';
import { FileMentionMenu } from './FileMentionMenu';
import {
  SessionDriftMenuSection,
  SessionDriftStatusGlyph,
  type SessionDriftLevel,
} from './SessionDriftControl';
import { useFileMentionAutocomplete } from './useFileMentionAutocomplete';

const composerTextareaMinHeight = 28;
const composerTextareaMaxHeight = 176;

type ComposerReasoningEffortSelection = Exclude<ControlPlaneReasoningEffortSelection, 'default'>;

const reasoningEfforts = [
  { value: 'low', labelKey: 'composer.reasoning.low' },
  { value: 'medium', labelKey: 'composer.reasoning.medium' },
  { value: 'high', labelKey: 'composer.reasoning.high' },
  { value: 'ultrahigh', labelKey: 'composer.reasoning.ultrahigh' },
] as const satisfies Array<{ value: ComposerReasoningEffortSelection; labelKey: I18nMessageKey }>;

const driftLevelMessageKeys = {
  unknown: 'composer.drift.signalUnknown',
  low: 'composer.drift.signalLow',
  medium: 'composer.drift.signalMedium',
  high: 'composer.drift.signalHigh',
} as const satisfies Record<SessionDriftLevel, I18nMessageKey>;

// ConversationComposer owns the prompt draft and visual controls. Session
// settings are API-backed by the parent session workflow.
export function ConversationComposer({
  disabled,
  driftEnabled,
  driftLevel,
  model,
  modelOptions,
  reasoningEffort,
  settingsUpdating,
  settingsError,
  submitting,
  onSubmitPrompt,
  onUpdateDriftEnabled,
  onUpdateModel,
  onUpdateReasoningEffort,
}: {
  disabled?: boolean;
  driftEnabled?: boolean;
  driftLevel?: SessionDriftLevel;
  model?: string;
  modelOptions?: ControlPlaneModelOptions;
  reasoningEffort?: Exclude<ControlPlaneReasoningEffortSelection, 'default'>;
  settingsUpdating?: boolean;
  settingsError?: string;
  submitting?: boolean;
  onSubmitPrompt: (prompt: string) => Promise<void>;
  onUpdateDriftEnabled?: (enabled: boolean) => Promise<void>;
  onUpdateModel?: (model: string) => Promise<void>;
  onUpdateReasoningEffort?: (value: ControlPlaneReasoningEffortSelection) => Promise<void>;
}) {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState('');
  const sendDisabled = disabled || submitting || !draft.trim();
  const effectiveDriftEnabled = driftEnabled ?? false;
  const effectiveDriftLevel = driftLevel ?? 'unknown';
  const effectiveReasoningEffort = reasoningEffort ?? 'medium';
  const reasoningLabel = t(reasoningEfforts.find((option) => option.value === effectiveReasoningEffort)?.labelKey ?? 'composer.reasoning.medium');
  const driftButtonLabel = effectiveDriftEnabled
    ? `${t('composer.addContext')}: ${t(driftLevelMessageKeys[effectiveDriftLevel])}`
    : t('composer.addContext');

  const handleSubmit = useCallback(async () => {
    const prompt = draft.trim();
    if (!prompt || sendDisabled) {
      return;
    }

    setDraft('');
    await onSubmitPrompt(prompt);
  }, [draft, onSubmitPrompt, sendDisabled]);
  const fileMentions = useFileMentionAutocomplete({
    value: draft,
    onValueChange: setDraft,
    textareaRef,
    disabled: disabled || submitting,
    onSubmit: handleSubmit,
  });

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = `${composerTextareaMinHeight}px`;
    const nextHeight = Math.min(textarea.scrollHeight, composerTextareaMaxHeight);
    textarea.style.height = `${Math.max(nextHeight, composerTextareaMinHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > composerTextareaMaxHeight ? 'auto' : 'hidden';
  }, [draft]);

  return (
    <form
      className="v2-composer-shell"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <Textarea
        ref={fileMentions.textareaRef}
        aria-label={t('composer.promptAriaLabel')}
        aria-activedescendant={fileMentions.textareaProps['aria-activedescendant']}
        aria-autocomplete={fileMentions.textareaProps['aria-autocomplete']}
        aria-controls={fileMentions.textareaProps['aria-controls']}
        aria-expanded={fileMentions.textareaProps['aria-expanded']}
        className="v2-composer-textarea"
        disabled={disabled || submitting}
        autoCapitalize="sentences"
        autoComplete="off"
        autoCorrect="on"
        enterKeyHint="send"
        inputMode="text"
        placeholder={t('composer.placeholder')}
        rows={1}
        spellCheck
        value={draft}
        onChange={fileMentions.textareaProps.onChange}
        onClick={fileMentions.textareaProps.onClick}
        onKeyDown={fileMentions.textareaProps.onKeyDown}
        onSelect={fileMentions.textareaProps.onSelect}
      />
      {fileMentions.isOpen ? <FileMentionMenu {...fileMentions.menuProps} /> : null}
      <div className="v2-composer-toolbar">
        <Popover>
          <span className="v2-composer-context-cluster">
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="none"
                className="v2-composer-context-button"
                aria-label={driftButtonLabel}
                disabled={disabled}
              >
                <Plus aria-hidden="true" data-icon="inline-start" />
              </Button>
            </PopoverTrigger>
            <span className="v2-composer-context-status">
              <SessionDriftStatusGlyph
                driftEnabled={effectiveDriftEnabled}
                driftLevel={effectiveDriftLevel}
              />
            </span>
          </span>
          <PopoverContent
            align="start"
            side="top"
            sideOffset={8}
            className="v2-composer-menu v2-composer-context-menu"
            aria-label={t('composer.contextMenu')}
          >
            {onUpdateDriftEnabled ? (
              <SessionDriftMenuSection
                disabled={disabled || settingsUpdating}
                driftEnabled={effectiveDriftEnabled}
                driftLevel={effectiveDriftLevel}
                updating={settingsUpdating}
                onUpdateDriftEnabled={onUpdateDriftEnabled}
              />
            ) : null}
          </PopoverContent>
        </Popover>
        <div className="v2-composer-toolbar-controls">
          <ComposerExecutionMenu
            disabled={disabled}
            settingsUpdating={settingsUpdating}
            model={model}
            modelOptions={modelOptions}
            reasoningEffort={effectiveReasoningEffort}
            reasoningLabel={reasoningLabel}
            onUpdateModel={onUpdateModel}
            onUpdateReasoningEffort={onUpdateReasoningEffort}
          />
          <Button
            type="submit"
            size="none"
            className="v2-composer-send-button"
            aria-label={t('composer.send')}
            disabled={sendDisabled}
          >
            <ArrowUp aria-hidden="true" data-icon="inline-start" />
          </Button>
        </div>
      </div>
      {settingsError ? <p className="v2-composer-error text-pretty">{settingsError}</p> : null}
    </form>
  );
}

interface ComposerExecutionMenuProps {
  model?: string;
  modelOptions?: ControlPlaneModelOptions;
  reasoningEffort: ComposerReasoningEffortSelection;
  reasoningLabel: string;
  disabled?: boolean;
  settingsUpdating?: boolean;
  onUpdateModel?: (model: string) => Promise<void>;
  onUpdateReasoningEffort?: (value: ControlPlaneReasoningEffortSelection) => Promise<void>;
}

function ComposerExecutionMenu({
  model,
  modelOptions,
  reasoningEffort,
  reasoningLabel,
  disabled,
  settingsUpdating,
  onUpdateModel,
  onUpdateReasoningEffort,
}: ComposerExecutionMenuProps) {
  const { t } = useI18n();
  const [modelSearch, setModelSearch] = useState('');
  const groups = modelOptions?.groups ?? [];
  const fallbackOptions = model ? [{
    label: undefined,
    models: [model],
    options: [{ id: model, label: undefined, disabled: false, disabledReason: undefined }],
  }] : [];
  const modelGroups = groups.length ? groups : fallbackOptions;
  const modelSearchQuery = modelSearch.trim().toLowerCase();
  const modelOptionCount = modelGroups.reduce((count, group) => count + group.options.length, 0);
  const showModelSearch = modelOptionCount > 6 || Boolean(modelSearchQuery);
  const filteredModelGroups = modelSearchQuery
    ? modelGroups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) => [
          group.label,
          option.id,
          option.label,
        ].some((value) => value?.toLowerCase().includes(modelSearchQuery))),
      }))
      .filter((group) => group.options.length)
    : modelGroups;
  const modelLabel = model ?? t('composer.model');
  const triggerLabel = `${modelLabel} · ${reasoningLabel}`;
  const triggerDisabled = disabled || settingsUpdating || (!onUpdateModel && !onUpdateReasoningEffort);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="none"
          className="v2-composer-execution-trigger"
          aria-label={`${t('composer.executionMenu')}: ${triggerLabel}`}
          aria-busy={settingsUpdating || undefined}
          disabled={triggerDisabled}
        >
          <span className="v2-composer-execution-label truncate">
            {triggerLabel}
          </span>
          <ChevronDown aria-hidden="true" data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={8}
        className="v2-composer-menu v2-composer-execution-menu"
        aria-label={t('composer.executionMenu')}
      >
        <div className="v2-composer-menu-section">
          <p className="v2-composer-menu-heading">
            {t('composer.reasoningEffort')}
          </p>
          <div className="v2-composer-menu-options">
            {reasoningEfforts.map((option) => (
              <ComposerMenuOption
                key={option.value}
                compact
                selected={reasoningEffort === option.value}
                disabled={!onUpdateReasoningEffort || settingsUpdating}
                onSelect={() => {
                  void onUpdateReasoningEffort?.(option.value);
                }}
              >
                {t(option.labelKey)}
              </ComposerMenuOption>
            ))}
          </div>
        </div>
        <div className="v2-composer-menu-section">
          <p className="v2-composer-menu-heading">
            {t('composer.model')}
          </p>
          {showModelSearch ? (
            <label className="v2-composer-model-search">
              <Search aria-hidden="true" data-icon="inline-start" />
              <input
                type="text"
                className="v2-composer-model-search-input"
                value={modelSearch}
                placeholder={t('composer.searchModels')}
                aria-label={t('composer.searchModels')}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) => {
                  setModelSearch(event.target.value);
                }}
              />
            </label>
          ) : null}
          <div className="v2-composer-menu-options">
            {filteredModelGroups.map((group) => (
              <div key={group.label ?? group.models.join(',')} className="v2-composer-menu-option-group">
                {group.label ? (
                  <p className="v2-composer-menu-group-heading">
                    {group.label}
                  </p>
                ) : null}
                {group.options.map((option) => (
                  <ComposerMenuOption
                    key={option.id}
                    selected={model === option.id}
                    disabled={!onUpdateModel || settingsUpdating || option.disabled}
                    description={option.disabledReason}
                    onSelect={() => {
                      void onUpdateModel?.(option.id);
                    }}
                  >
                    {option.label ?? option.id}
                  </ComposerMenuOption>
                ))}
              </div>
            ))}
            {filteredModelGroups.length ? null : (
              <p className="v2-composer-menu-empty text-pretty">
                {t('composer.noModelMatches')}
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ComposerMenuOption({
  children,
  description,
  compact,
  selected,
  disabled,
  onSelect,
}: {
  children: ReactNode;
  description?: string;
  compact?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="none"
      className={cn('v2-composer-menu-option justify-between text-left', compact && 'v2-composer-menu-option-compact')}
      role="menuitemradio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
    >
      <span className="v2-composer-menu-option-copy">
        <span className="v2-composer-menu-option-label truncate">
          {children}
        </span>
        {description ? (
          <span className="v2-composer-menu-option-description truncate">
            {description}
          </span>
        ) : null}
      </span>
      {selected ? <Check aria-hidden="true" data-icon="inline-end" /> : null}
    </Button>
  );
}
