import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { Notification } from '@/services/types';
import { useUser } from './auth';
import { useServices } from './services';
import { useLiveEvents } from './useLive';

/**
 * Shared in-account notifications. Layout's bell and the account page must see
 * the same unread count — a per-component useState left the badge stale after
 * "Mark all as read".
 */
type Snap = { list: Notification[] | null; unread: number };

let snap: Snap = { list: null, unread: 0 };
const listeners = new Set<() => void>();

function getSnap() {
  return snap;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function setSnap(next: Snap) {
  snap = next;
  listeners.forEach((l) => l());
}

export function useNotifications() {
  const user = useUser();
  const { account } = useServices();
  const { list, unread } = useSyncExternalStore(subscribe, getSnap, getSnap);
  const signedIn = !!user;

  const load = useCallback(() => {
    if (!signedIn) return;
    account
      .notifications()
      .then((r) => setSnap({ list: r.notifications, unread: r.unread }))
      .catch(() => setSnap({ list: snap.list ?? [], unread: snap.unread }));
  }, [account, signedIn]);

  useEffect(() => {
    if (!signedIn) {
      setSnap({ list: [], unread: 0 });
      return;
    }
    load();
  }, [signedIn, load]);

  useLiveEvents((e) => {
    if (e.type === 'notification.created') load();
  }, signedIn);

  const markRead = useCallback(
    async (ids?: string[]) => {
      const nextUnread = await account.markNotificationsRead(ids);
      const now = Date.now();
      setSnap({
        unread: nextUnread,
        list:
          snap.list?.map((n) => (!ids || ids.includes(n.id) ? { ...n, readAt: n.readAt ?? now } : n)) ?? snap.list,
      });
    },
    [account],
  );

  return { list: signedIn ? list : [], unread: signedIn ? unread : 0, markRead, reload: load };
}
