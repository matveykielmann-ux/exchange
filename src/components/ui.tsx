import type { ReactNode } from 'react';
import type { OrderTone as StatusTone } from '@/domain/order';
import { useIsSandbox } from '@/state/config';
import { Icon, type IconName } from './Icon';
import { t, tNode } from '@/i18n';

/**
 * Marks simulated data. Rendered whenever the server runs in sandbox mode (or
 * when `force` says this record itself is simulated), so a sandbox price,
 * quote, receipt or status can never be mistaken for a real one.
 */
export function MockBadge({ label = 'Sandbox', force = false }: { label?: string; force?: boolean }) {
  const sandbox = useIsSandbox();
  if (!sandbox && !force) return null;
  return (
    <span className="badge badge--mock" title={t('Simulated sandbox data: not a real price, quote, deposit or payout')}>
      {t(label)}
    </span>
  );
}

const TONE_ICON: Record<StatusTone, IconName> = {
  info: 'clock',
  success: 'check',
  warn: 'alert',
  danger: 'x',
  neutral: 'info',
};

export function StatusBadge({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span className={`badge badge--${tone}`}>
      <Icon name={TONE_ICON[tone]} />
      {tNode(children)}
    </span>
  );
}

type NoticeTone = 'info' | 'warn' | 'danger' | 'neutral';
const NOTICE_ICON: Record<NoticeTone, IconName> = { info: 'info', warn: 'alert', danger: 'alert', neutral: 'info' };

export function Notice({
  tone = 'info',
  title,
  children,
  role,
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  role?: 'status' | 'alert';
}) {
  return (
    <div className={`notice notice--${tone}`} role={role}>
      <Icon name={NOTICE_ICON[tone]} />
      <div>
        {title ? <p className="notice__title">{tNode(title)}</p> : null}
        {children ? (
          <div className="stack" style={{ gap: 6 }}>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="container">
        {eyebrow ? <p className="eyebrow">{t(eyebrow)}</p> : null}
        <h1 className="display-l">{tNode(title)}</h1>
        {lead ? <p className="lead">{tNode(lead)}</p> : null}
        {children}
      </div>
    </header>
  );
}

export function AssetMark({ code }: { code: string }) {
  return (
    <span className="asset-mark" aria-hidden="true">
      {code.slice(0, 4)}
    </span>
  );
}
