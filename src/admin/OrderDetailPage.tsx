import { Link, useParams } from 'react-router-dom';
import { t } from '@/i18n';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { OrderCard } from './OrderCard';

/** One order on its own page (shareable link). The same card opens as a side panel from the order queue. */
export function OrderDetailPage() {
  const { id = '' } = useParams();
  useDocumentTitle('Order');
  return (
    <div className="stack" style={{ maxWidth: 920 }}>
      <p className="small">
        <Link to="/admin/orders">{t('← Orders')}</Link>
      </p>
      <OrderCard id={id} />
    </div>
  );
}
