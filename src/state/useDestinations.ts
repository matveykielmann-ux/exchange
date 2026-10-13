import { useCallback, useEffect, useState } from 'react';
import type { PayoutDestinationRecord } from '@/services/types';
import { useUser } from './auth';
import { useServices } from './services';

/** The signed-in customer's saved payout destinations, with a reload function. */
export function useDestinations() {
  const user = useUser();
  const { payouts } = useServices();
  const [list, setList] = useState<PayoutDestinationRecord[] | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    payouts
      .listDestinations(user.email)
      .then((l) => !cancelled && setList(l))
      .catch(() => !cancelled && setList([]));
    return () => {
      cancelled = true;
    };
  }, [payouts, user, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { list, reload };
}
