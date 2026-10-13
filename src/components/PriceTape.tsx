import { useEffect, useRef, useState } from 'react';
import { ASSET_ORDER, ASSETS, type AssetCode } from '@/domain/assets';
import { PRICING_POLICY } from '@/domain/quote';
import { formatPriceMicros } from '@/lib/format';
import { gsap, REDUCED_OK, useGSAP } from '@/lib/motion';
import { useServices } from '@/state/services';
import { MockBadge } from './ui';

type Row = { price: bigint; prev: bigint | null };

/** Change since the previous refresh, in hundredths of a percent (integer maths, display only). */
function changeText(row: Row): string {
  if (row.prev === null || row.prev === 0n) return 'Updates every ' + PRICING_POLICY.indicativeRefreshMs / 1000 + 's';
  const bp = Number(((row.price - row.prev) * 10_000n) / row.prev);
  if (bp === 0) return 'Unchanged since last update';
  return `${bp > 0 ? '▲' : '▼'} ${(Math.abs(bp) / 100).toFixed(2)}% since last update`;
}

/**
 * Terminal-style strip of mock reference prices. Refreshes on the indicative
 * cadence; a changed cell gets a short neutral highlight (no red/green, see
 * design-spec §7). The highlight is skipped when reduced motion is requested.
 */
export function PriceTape() {
  const { pricing } = useServices();
  const [rows, setRows] = useState<Partial<Record<AssetCode, Row>>>({});
  const ref = useRef<HTMLDivElement>(null);
  const changed = useRef<AssetCode[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      let prices: Awaited<ReturnType<typeof pricing.prices>>;
      try {
        prices = await pricing.prices();
      } catch {
        return; // Keep the last prices; the cells show their age through the next refresh.
      }
      if (!alive) return;
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
    <div className="tape" ref={ref} role="region" aria-label="Reference prices">
      {ASSET_ORDER.map((a) => {
        const row = rows[a];
        return (
          <div className="tape__cell" key={a} data-asset={a}>
            <span className="tape__flash" aria-hidden="true" />
            <span className="tape__name">
              {ASSETS[a].name} · {a}
            </span>
            <span className="tape__price">{row ? formatPriceMicros(row.price, a) : '—'}</span>
            <span className="tape__change">{row ? changeText(row) : 'Loading'}</span>
          </div>
        );
      })}
      <div className="tape__badge">
        <MockBadge label="Sandbox prices" />
      </div>
    </div>
  );
}
