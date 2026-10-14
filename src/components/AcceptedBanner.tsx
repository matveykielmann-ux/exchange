import { Link } from 'react-router-dom';
import { SUPPORT } from '@/config/brand';
import { Icon } from './Icon';

/**
 * Shown once, right after an order is created. It confirms the request was
 * received and where to follow it; it never says a manager has been in touch.
 */
export function AcceptedBanner({ reference, detailsId }: { reference: string; detailsId: string }) {
  return (
    <section className="accepted-banner" role="status" aria-labelledby="accepted-title">
      <span className="accepted-banner__icon" aria-hidden="true">
        <Icon name="check" width={22} height={22} />
      </span>
      <div>
        <p id="accepted-title" className="accepted-banner__title">
          Request accepted
        </p>
        <p>
          Order <span className="mono">{reference}</span>. Follow its status in your account. To reach a manager, use Telegram or the
          messages on this site.
        </p>
        <div className="accepted-banner__actions">
          <a className="btn" href={SUPPORT.telegramUrl} target="_blank" rel="noopener noreferrer">
            <Icon name="send" width={16} height={16} /> Contact us on Telegram
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
          <a className="btn btn--secondary" href={`#${detailsId}`}>
            Open the order
          </a>
          <Link className="btn btn--secondary" to="/account">
            Go to your account
          </Link>
        </div>
      </div>
    </section>
  );
}
