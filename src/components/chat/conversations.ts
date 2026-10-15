import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '@/lib/errors';
import type { ConversationStatus, ConversationSummary } from '@/services/types';
import { useServices } from '@/state/services';
import { useLiveEvents, useLiveState } from '@/state/useLive';

export const CONVERSATION_STATUS_LABEL: Record<ConversationStatus, string> = {
  open: 'Open',
  pending: 'Waiting on you',
  resolved: 'Resolved',
};

/** The signed-in customer's conversations, refreshed live (or every 15 s while the live stream is down). */
export function useCustomerConversations(enabled = true) {
  const { support } = useServices();
  const live = useLiveState();
  const [list, setList] = useState<ConversationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    support
      .list()
      .then((l) => {
        if (cancelled) return;
        setList(l);
        setError(null);
      })
      .catch((e: unknown) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [enabled, support, version]);
  useLiveEvents((e) => {
    if (e.type === 'message.created' || e.type === 'conversation.updated') reload();
  }, enabled);
  useEffect(() => {
    if (!enabled || live === 'open') return;
    const t = window.setInterval(reload, 15_000);
    return () => window.clearInterval(t);
  }, [enabled, live, reload]);
  return { list, error, reload };
}
