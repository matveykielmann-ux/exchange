import { useCallback, useEffect, useState } from 'react';
import type { Destination } from '@/services/types';
import { useUser } from './auth';
import { useServices } from './services';

/** The signed-in customer's saved payout destinations (masked: label and last four only), with a reload function. */
export function useDestinations() {
  const user = useUser();
  const { account } = useServices();
  const [list, setList] = useState<Destination[] | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    account
      .destinations()
      .then((l) => !cancelled && setList(l))
      .catch(() => !cancelled && setList([]));
    return () => {
      cancelled = true;
    };
  }, [account, user, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { list, reload };
}
