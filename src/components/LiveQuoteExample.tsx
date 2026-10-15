import { useEffect, useState } from 'react';
import type { AssetCode, NetworkId } from '@/domain/assets';
import { formatPriceMicros } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import type { Quote } from '@/domain/quote';
import type { PayoutMethodId } from '@/domain/payout';
import { useServices } from '@/state/services';
import { QuoteBreakdown } from './QuoteBreakdown';
import { QuoteSkeleton } from './QuoteSkeleton';
import { Notice } from './ui';
import { t } from '@/i18n';

/**
 * Worked example built from the live rates provider (same path as the calculator).
 * Shows unavailable when market pricing cannot be fetched — never invents a price.
 * Loading is derived from whether the stored result matches the current request key
 * (no synchronous setState in the effect).
 */
export function LiveQuoteExample({
  asset,
  network,
  amountAtomic,
  payoutMethod,
  caption,
}: {
  asset: AssetCode;
  network: NetworkId;
  amountAtomic: bigint;
  payoutMethod: PayoutMethodId;
  /** Caption with `{rate}` replaced by the live reference price when ready. */
  caption: (rateLabel: string) => string;
}) {
  const { quotes } = useServices();
  const amountKey = amountAtomic.toString();
  const requestKey = `${asset}|${network}|${amountKey}|${payoutMethod}`;
  const [stored, setStored] = useState<{ key: string; quote: Quote | null; error: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    quotes
      .indicative({ asset, network, amountAtomic, payoutMethod })
      .then((data) => {
        if (!cancelled) setStored({ key: requestKey, quote: data.quote, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled) setStored({ key: requestKey, quote: null, error: errorMessage(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [quotes, asset, network, amountAtomic, amountKey, payoutMethod, requestKey]);

  if (stored?.key !== requestKey) {
    return (
      <div className="panel">
        <div className="panel__body">
          <QuoteSkeleton rows={5} />
        </div>
      </div>
    );
  }
  if (stored.error || !stored.quote) {
    return (
      <Notice tone="warn" title={t('Rate unavailable')}>
        <p>{t('A live example cannot be shown until market prices are available.')}</p>
      </Notice>
    );
  }
  const rateLabel = formatPriceMicros(stored.quote.referencePriceMicros, stored.quote.asset);
  return (
    <figure className="panel anatomy__example">
      <div className="panel__head">
        <h3>{t('Example quote')}</h3>
      </div>
      <div className="panel__body">
        <QuoteBreakdown quote={stored.quote} />
      </div>
      <figcaption className="small muted anatomy__caption">{caption(rateLabel)}</figcaption>
    </figure>
  );
}
