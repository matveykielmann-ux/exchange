import { useEffect, useState } from 'react';

/**
 * True once `at` has passed. Uses one timeout (firing immediately for a past
 * deadline) instead of a per-second tick, so the caller re-renders only once.
 */
export function useExpired(at: number | null): boolean {
  const [expiredAt, setExpiredAt] = useState<number | null>(null);
  useEffect(() => {
    if (at === null) return;
    const t = window.setTimeout(() => setExpiredAt(at), Math.max(0, at - Date.now()));
    return () => window.clearTimeout(t);
  }, [at]);
  return at !== null && expiredAt === at;
}
