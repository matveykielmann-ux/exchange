import { useSyncExternalStore } from 'react';
import type { User } from '@/services/types';
import { useServices } from './services';

/** The signed-in user as the server last reported it, kept in sync with the session store. */
export function useUser(): User | null {
  const { session } = useServices();
  return useSyncExternalStore(session.subscribe, session.current, () => null);
}

export const STAFF_ROLES = ['support', 'reviewer', 'admin', 'owner'] as const;
export const isStaff = (u: User | null) => !!u && (STAFF_ROLES as readonly string[]).includes(u.role);
