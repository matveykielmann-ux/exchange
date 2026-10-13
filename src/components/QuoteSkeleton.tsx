import { Skeleton } from '@/components/ui/skeleton';

/** Placeholder with the shape of `<QuoteBreakdown>` while the first quote is on its way. */
export function QuoteSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="quote-skeleton" aria-busy="true">
      <span className="sr-only">Getting a quote…</span>
      <div className="quote-lines" aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i}>
            <Skeleton className="quote-skeleton__bar" style={{ width: `${[46, 58, 40, 52][i % 4]}%` }} />
            <Skeleton className="quote-skeleton__bar" style={{ width: '22%' }} />
          </div>
        ))}
      </div>
      <div className="quote-total" aria-hidden="true">
        <Skeleton className="quote-skeleton__bar" style={{ width: '30%' }} />
        <Skeleton className="quote-skeleton__bar quote-skeleton__bar--total" style={{ width: '42%' }} />
      </div>
    </div>
  );
}
