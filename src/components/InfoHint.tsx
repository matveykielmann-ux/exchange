import type { ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Icon } from './Icon';
import { t } from '@/i18n';

/**
 * Small "what is this?" button that opens a short explanation (shadcn Popover).
 * A popover rather than a hover tooltip, so it also works on touch screens and with the keyboard.
 */
export function InfoHint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger className="info-hint" aria-label={t('About {0}', [label])}>
        <Icon name="info" width={14} height={14} />
      </PopoverTrigger>
      <PopoverContent className="info-hint__content" side="top" align="start">
        {children}
      </PopoverContent>
    </Popover>
  );
}
