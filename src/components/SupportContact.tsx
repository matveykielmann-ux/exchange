import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SUPPORT } from '@/config/brand';
import { Icon } from './Icon';

/** The official Telegram support link (clause 4.21). Opens in a new tab. */
export function TelegramLink({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <a href={SUPPORT.telegramUrl} target="_blank" rel="noopener noreferrer" className={className}>
      {children ?? `Telegram ${SUPPORT.telegramHandle}`}
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}

/**
 * Support contact block used on the exchange form, order statuses and the
 * success screen: the official Telegram support and the in-app support
 * messages, with the Service working hours.
 */
export function SupportContact({
  title = 'Need help?',
  orderReference,
  children,
}: {
  title?: string;
  orderReference?: string;
  children?: ReactNode;
}) {
  return (
    <div className="support-contact">
      <p className="support-contact__title">
        <Icon name="chat" width={18} height={18} /> {title}
      </p>
      {children ? <div className="support-contact__body small">{children}</div> : null}
      <div className="support-contact__actions">
        <TelegramLink className="btn btn--secondary btn--sm">
          <Icon name="send" width={16} height={16} /> Contact support on Telegram
        </TelegramLink>
        <Link className="link-button small" to="/support/new">
          Message support here{orderReference ? ` about ${orderReference}` : ''}
        </Link>
      </div>
      <p className="small muted">Working hours: {SUPPORT.hours.label}. Use only the official contacts listed on this site.</p>
    </div>
  );
}
