import { Link } from 'react-router-dom';
import { formatDateTime } from '@/lib/format';
import { notificationText } from '@/i18n/notifications';
import type { Notification } from '@/services/types';
import { t } from '@/i18n';

/** One in-account notice: unread marker, subject, text, time and a link to its order. */
export function NotificationItem({ n, onOpen }: { n: Notification; onOpen?: () => void }) {
  const unread = !n.readAt;
  const text = notificationText(n);
  return (
    <li className={`notice-item${unread ? ' is-unread' : ''}`}>
      <span className="notice-item__dot" aria-hidden="true" />
      <div className="notice-item__body">
        <p className="notice-item__title">
          {unread ? <span className="visually-hidden">{t('Unread:')} </span> : null}
          {text.subject}
        </p>
        <p className="small muted">{text.body}</p>
        <p className="small notice-item__meta">
          <span className="tabular">{formatDateTime(n.createdAt)}</span>
          {n.orderId ? (
            <Link to={`/orders/${n.orderId}`} onClick={onOpen}>
              {t('Open order')}
            </Link>
          ) : null}
          {unread && onOpen ? (
            <button type="button" className="link-button" onClick={onOpen}>
              {t('Mark as read')}
            </button>
          ) : null}
        </p>
      </div>
    </li>
  );
}
