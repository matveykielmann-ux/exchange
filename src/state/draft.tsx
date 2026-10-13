/**
 * The in-progress exchange, persisted to sessionStorage so it survives the
 * sign-in round trip. Holds only user choices — never prices or quotes, which
 * are always fetched fresh.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { defaultNetwork, isAssetCode, isSupportedPair, type AssetCode, type NetworkId } from '@/domain/assets';
import type { PayoutMethodId } from '@/domain/payout';

export interface ExchangeDraft {
  asset: AssetCode;
  network: NetworkId;
  amount: string;
  payoutMethod: PayoutMethodId;
  destinationId: string | null;
  refundAddress: string;
  step: 1 | 2 | 3 | 4;
}

const KEY = 'settlewell.mock.v1.draft';

export const INITIAL_DRAFT: ExchangeDraft = {
  asset: 'BTC',
  network: 'bitcoin',
  amount: '0.05',
  payoutMethod: 'ach',
  destinationId: null,
  refundAddress: '',
  step: 1,
};

function load(): ExchangeDraft {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return INITIAL_DRAFT;
    const parsed = { ...INITIAL_DRAFT, ...(JSON.parse(raw) as Partial<ExchangeDraft>) };
    if (!isAssetCode(parsed.asset) || !isSupportedPair(parsed.asset, parsed.network)) return INITIAL_DRAFT;
    return parsed;
  } catch {
    return INITIAL_DRAFT;
  }
}

interface DraftContextValue {
  draft: ExchangeDraft;
  update: (patch: Partial<ExchangeDraft>) => void;
  setAsset: (asset: AssetCode) => void;
  reset: () => void;
}

const DraftContext = createContext<DraftContextValue | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<ExchangeDraft>(load);

  const persist = useCallback((next: ExchangeDraft) => {
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — keep in memory */
    }
    return next;
  }, []);

  const update = useCallback((patch: Partial<ExchangeDraft>) => setDraft((d) => persist({ ...d, ...patch })), [persist]);
  const setAsset = useCallback(
    (asset: AssetCode) =>
      setDraft((d) =>
        persist({ ...d, asset, network: isSupportedPair(asset, d.network) ? d.network : defaultNetwork(asset), refundAddress: '' }),
      ),
    [persist],
  );
  const reset = useCallback(() => setDraft(persist(INITIAL_DRAFT)), [persist]);

  const value = useMemo(() => ({ draft, update, setAsset, reset }), [draft, update, setAsset, reset]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftContextValue {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useDraft must be used inside <DraftProvider>');
  return ctx;
}
