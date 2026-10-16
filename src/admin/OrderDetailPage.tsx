import { Link, useParams } from 'react-router-dom';
import { t } from '@/i18n';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { OrderCard } from './OrderCard';

/** One order on its own full-page view (opened from the queue or a shareable link). */
export function OrderDetailPage() {
  const { id = '' } = useParams();
  useDocumentTitle('Order');
  return (
    <div className="stack order-detail-page">
      <p className="small">
        <Link to="/admin/orders">{t('← Orders')}</Link>
      </p>
      <OrderCard id={id} />
    </div>
  );
}
