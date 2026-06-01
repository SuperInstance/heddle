import type { ControlPlaneSessionDetail } from '@web/hooks/sessions/useControlPlaneSessionDetail';
import { useI18n, type I18nMessageKey } from '@web/i18n';

type DirectShellResult = NonNullable<NonNullable<ControlPlaneSessionDetail>['messages'][number]['directShellResult']>;

export function DirectShellResultMessage({ result }: { result: DirectShellResult }) {
  const { t } = useI18n();
  const outcome = result.outcome === 'done'
    ? t('composer.directShell.outcomeDone')
    : t('composer.directShell.outcomeError');

  return (
    <div className="v2-direct-shell-result">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="v2-type-caption text-muted-foreground">{t('composer.directShell.resultTitle')}</p>
          <code className="v2-type-code block truncate text-foreground">{result.command}</code>
        </div>
        <span className={result.outcome === 'done' ? 'text-emerald-300' : 'text-red-300'}>
          {outcome}
        </span>
      </div>
      {result.policy?.reason ? (
        <p className="v2-type-caption mt-2 text-muted-foreground">{result.policy.reason}</p>
      ) : null}
      {result.stdout ? <ShellOutput labelKey="composer.directShell.stdout" value={result.stdout} /> : null}
      {result.stderr ? <ShellOutput labelKey="composer.directShell.stderr" value={result.stderr} /> : null}
      {result.error ? <ShellOutput labelKey="composer.directShell.error" value={result.error} tone="error" /> : null}
    </div>
  );
}

function ShellOutput({ labelKey, value, tone }: { labelKey: I18nMessageKey; value: string; tone?: 'error' }) {
  const { t } = useI18n();

  return (
    <div className="mt-3">
      <p className="v2-type-caption mb-1 text-muted-foreground">{t(labelKey)}</p>
      <pre className={tone === 'error' ? 'v2-direct-shell-output text-red-200' : 'v2-direct-shell-output'}>
        {value}
      </pre>
    </div>
  );
}
