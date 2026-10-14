/** Admin helpers shared by the workspace pages. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Role } from '@/services/types';

/** Loads data on mount and whenever `deps` change; `reload` re-runs it. Errors are kept, never replaced with placeholder data. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [version, setVersion] = useState(0);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    let cancelled = false;
    loadRef
      .current()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers pass the inputs that matter
  }, [...deps, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, setData, error, reload };
}

const RANK: Record<Role, number> = { customer: 0, support: 1, reviewer: 2, admin: 3, owner: 4 };
/** Navigation hint only: the server authorizes every request by role. */
export const atLeast = (role: Role | undefined, min: Role) => !!role && RANK[role] >= RANK[min];

export const ROLE_LABEL: Record<Role, string> = {
  customer: 'Customer',
  support: 'Support',
  reviewer: 'Reviewer',
  admin: 'Admin',
  owner: 'Owner',
};

export function minutes(n: number | null): string {
  if (n === null) return '—';
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  if (h < 48) return `${h} h ${n % 60} min`;
  return `${Math.floor(h / 24)} d`;
}

export function shortId(id: string | null | undefined): string {
  return id ? (id.length > 14 ? `${id.slice(0, 10)}…` : id) : '—';
}
