import { useCallback, useEffect, useState } from 'react';
import type { Notification } from '@/services/types';
import { useUser } from './auth';
import { useServices } from './services';
import { useLiveEvents } from './useLive';

/**
 * The signed-in customer's in-account notifications and unread count, kept
 * current by live server events (a new notice, or an order status change).
 */
export function useNotifications() {
  const user = useUser();
  const { account } = useServices();
  const [list, setList] = useState<Notification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const signedIn = !!user;
  const load = useCallback(() => {
    if (!signedIn) return;
    account
      .notifications()
      .then((r) => {
        setList(r.notifications);
        setUnread(r.unread);
      })
      .catch(() => setList((l) => l ?? []));
  }, [account, signedIn]);
  useEffect(load, [load]);
  useLiveEvents((e) => {
    if (e.type === 'notification.created') load();
  }, signedIn);
  const markRead = useCallback(
    async (ids?: string[]) => {
      setUnread(await account.markNotificationsRead(ids));
      setList((l) => l?.map((n) => (!ids || ids.includes(n.id) ? { ...n, readAt: n.readAt ?? Date.now() } : n)) ?? l);
    },
    [account],
  );
  return { list: signedIn ? list : [], unread: signedIn ? unread : 0, markRead, reload: load };
}
