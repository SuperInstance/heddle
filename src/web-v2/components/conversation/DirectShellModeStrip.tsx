import { Terminal } from 'lucide-react';
import { useI18n } from '@web/i18n';

export function DirectShellModeStrip({ command }: { command: string }) {
  const { t } = useI18n();

  return (
    <div className="v2-direct-shell-mode-strip">
      <Terminal aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="v2-type-caption font-medium">{t('composer.directShell.modeLabel')}</span>
      <span className="v2-type-caption shrink-0 text-amber-100/70">{t('composer.directShell.runs')}</span>
      <code className="v2-type-code min-w-0 truncate text-amber-50">
        {command || t('composer.directShell.emptyCommand')}
      </code>
    </div>
  );
}
