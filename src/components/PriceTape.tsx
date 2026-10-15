import { useEffect, useRef, useState } from 'react';
import { ASSET_ORDER, ASSETS, type AssetCode } from '@/domain/assets';
import { PRICING_POLICY } from '@/domain/quote';
import { formatPriceMicros } from '@/lib/format';
import { gsap, REDUCED_OK, useGSAP } from '@/lib/motion';
import { useServices } from '@/state/services';
import { t } from '@/i18n';

type Row = { price: bigint; prev: bigint | null };

/** Change since the previous refresh, in hundredths of a percent (integer maths, display only). */
function changeText(row: Row): string {
  if (row.prev === null || row.prev === 0n) return t('Updates every {0}s', [PRICING_POLICY.indicativeRefreshMs / 1000]);
  const bp = Number(((row.price - row.prev) * 10_000n) / row.prev);
  if (bp === 0) return t('Unchanged since last update');
  return t('{0} {1}% since last update', [bp > 0 ? '▲' : '▼', (Math.abs(bp) / 100).toFixed(2)]);
}

/**
 * Terminal-style strip of reference prices (configured rates schedule, or CoinGecko
 * when the server runs with RATES_SOURCE=coingecko). Refreshes on the indicative
 * cadence; a changed cell gets a short neutral highlight (no red/green, see
 * design-spec §7). The highlight is skipped when reduced motion is requested.
 */
export function PriceTape() {
  const { pricing } = useServices();
  const [rows, setRows] = useState<Partial<Record<AssetCode, Row>>>({});
  const [unavailable, setUnavailable] = useState(false);
  const [feed, setFeed] = useState<'coingecko' | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const changed = useRef<AssetCode[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      let prices: Awaited<ReturnType<typeof pricing.prices>>;
      try {
        prices = await pricing.prices();
      } catch {
        // The server serves a price only while it is fresh, so a failed refresh means there is no current rate.
        if (alive) setUnavailable(true);
        return;
      }
      if (!alive) return;
      setUnavailable(false);
      setFeed(prices.find((p) => p.feed)?.feed ?? null);
      setRows((old) => {
        const next: Partial<Record<AssetCode, Row>> = {};
        changed.current = [];
        for (const p of prices) {
          const prev = old[p.asset]?.price ?? null;
          if (prev !== null && prev !== p.priceMicros) changed.current.push(p.asset);
          next[p.asset] = { price: p.priceMicros, prev };
        }
        return next;
      });
    };
    void load();
    const id = window.setInterval(load, PRICING_POLICY.indicativeRefreshMs);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [pricing]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(REDUCED_OK, () => {
        for (const a of changed.current) {
          gsap.fromTo(`[data-asset="${a}"] .tape__flash`, { opacity: 1 }, { opacity: 0, duration: 0.9, ease: 'power2.out' });
        }
      });
    },
    { dependencies: [rows], scope: ref },
  );

  return (
    <div className="tape" ref={ref} role="region" aria-label={t('Reference prices')}>
      {ASSET_ORDER.map((a) => {
        const row = rows[a];
        return (
          <div className="tape__cell" key={a} data-asset={a}>
            <span className="tape__flash" aria-hidden="true" />
            <span className="tape__name">
              {ASSETS[a].name} · {a}
            </span>
            <span className="tape__price">{row && !unavailable ? formatPriceMicros(row.price, a) : '—'}</span>
            <span className="tape__change">{unavailable ? t('Rate unavailable') : row ? changeText(row) : t('Loading')}</span>
          </div>
        );
      })}
      <div className="tape__badge">
        {feed === 'coingecko' ? (
          <span className="tape__source">{t('Indicative prices: CoinGecko')}</span>
        ) : (
          <span className="tape__source">{t('Reference prices')}</span>
        )}
      </div>
    </div>
  );
}
