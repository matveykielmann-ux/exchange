import type { ReactNode } from 'react';
import type { StatusTone } from '@/domain/transaction';
import { Icon, type IconName } from './Icon';

export function MockBadge({ label = 'Demo' }: { label?: string }) {
  return (
    <span className="badge badge--mock" title="Simulated data — not a real price, quote or transaction">
      {label}
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
      {children}
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
        {title ? <p className="notice__title">{title}</p> : null}
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
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="display-l">{title}</h1>
        {lead ? <p className="lead">{lead}</p> : null}
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
