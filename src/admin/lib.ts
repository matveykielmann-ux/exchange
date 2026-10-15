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

/**
 * CRM staff is a single Admin role in the product. Legacy support/reviewer/owner
 * ranks still authorize on the server; the UI presents them all as Admin.
 */
const RANK: Record<Role, number> = { customer: 0, support: 3, reviewer: 3, admin: 3, owner: 3 };
/** Navigation hint only: the server authorizes every request by role. */
export const atLeast = (role: Role | undefined, min: Role) => !!role && RANK[role] >= RANK[min];

export const ROLE_LABEL: Record<Role, string> = {
  customer: 'Customer',
  support: 'Admin',
  reviewer: 'Admin',
  admin: 'Admin',
  owner: 'Admin',
};

/** Staff badge text — always Admin for CRM operators. */
export function staffRoleLabel(role: Role): string {
  return role === 'customer' ? ROLE_LABEL.customer : 'Admin';
}

/** Roles an admin may assign to staff accounts (single product role). */
export const STAFF_ASSIGNABLE_ROLES: Role[] = ['admin'];

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
