import { useSyncExternalStore } from 'react';
import type { User } from '@/services/types';
import { useServices } from './services';

/** Current signed-in user (mock session), kept in sync with the auth service. */
export function useUser(): User | null {
  const { auth } = useServices();
  return useSyncExternalStore(
    (cb) => auth.subscribe(cb),
    () => snapshot(auth.currentUser()),
    () => null,
  );
}

// useSyncExternalStore needs a referentially stable snapshot between changes.
let last: User | null = null;
function snapshot(u: User | null): User | null {
  if (u === last) return last;
  if (u && last && u.email === last.email && u.verification === last.verification && u.name === last.name) return last;
  last = u;
  return u;
}
