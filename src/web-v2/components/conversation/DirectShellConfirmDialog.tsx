import type { ControlPlaneSessionDirectShellPreflight } from '@web/api/client';
import { Button } from '@web/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@web/components/ui/dialog';
import { useI18n } from '@web/i18n';

type DirectShellConfirmDialogProps = {
  confirmation?: ControlPlaneSessionDirectShellPreflight;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

export function DirectShellConfirmDialog({
  confirmation,
  submitting,
  onCancel,
  onConfirm,
}: DirectShellConfirmDialogProps) {
  const { t } = useI18n();
  const updateOpen = (open: boolean) => {
    if (!open && !submitting) {
      onCancel();
    }
  };

  return (
    <Dialog open={Boolean(confirmation)} onOpenChange={updateOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('composer.directShell.confirmTitle')}</DialogTitle>
          <DialogDescription>
            {t('composer.directShell.confirmDescription')}
          </DialogDescription>
        </DialogHeader>

        {confirmation ? (
          <div className="rounded-md border border-border bg-background px-3 py-2">
            <code className="v2-type-code block whitespace-pre-wrap break-words text-foreground">
              {confirmation.command}
            </code>
            {confirmation.reason ? (
              <p className="v2-type-caption mt-2 text-muted-foreground">{confirmation.reason}</p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={submitting} onClick={onCancel}>
            {t('composer.directShell.cancel')}
          </Button>
          <Button type="button" disabled={submitting || !confirmation} onClick={() => void onConfirm()}>
            {t('composer.directShell.runOnce')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
