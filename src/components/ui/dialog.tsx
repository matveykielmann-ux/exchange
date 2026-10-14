import type { ReactNode } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { XIcon } from 'lucide-react';
import { t } from '@/i18n';

/**
 * A small centred dialog for confirming an action. Focus is trapped while it
 * is open and returns to the trigger on close; Escape closes it unless `busy`.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  busy = false,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  busy?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (busy ? undefined : onOpenChange(o))}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content className="dialog" {...(description ? {} : { 'aria-describedby': undefined })}>
          <div className="dialog__head">
            <DialogPrimitive.Title className="dialog__title">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close className="dialog__close" disabled={busy}>
              <XIcon width={18} height={18} aria-hidden="true" />
              <span className="visually-hidden">{t('Close')}</span>
            </DialogPrimitive.Close>
          </div>
          {description ? <DialogPrimitive.Description className="dialog__desc">{description}</DialogPrimitive.Description> : null}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
