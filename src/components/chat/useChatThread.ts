import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clientId } from '@/services/http';
import type { Conversation, Message } from '@/services/types';
import { errorMessage } from '@/lib/errors';
import { useLiveEvents, useLiveState } from '@/state/useLive';

/** A message typed in this browser that the server hasn't stored yet (or refused). */
export interface PendingMessage {
  clientMessageId: string;
  body: string;
  internal: boolean;
  state: 'sending' | 'failed';
  error?: string;
  createdAt: number;
}

export interface ChatThreadSource<C extends Conversation> {
  load(id: string): Promise<C>;
  send(id: string, body: string, clientMessageId: string, internal: boolean): Promise<Message>;
  markRead(id: string): Promise<void>;
}

/** How long to wait between refreshes while the live stream is down. */
const POLL_MS = 10_000;

/**
 * One support conversation as the server stores it, plus the messages this
 * browser is still sending. The server is the only record: a message shows as
 * "sent" only once the server has returned it, and a failed send keeps its
 * client id so a retry can't create a duplicate.
 */
export function useChatThread<C extends Conversation>(id: string | null, source: ChatThreadSource<C>) {
  const [conversation, setConversation] = useState<C | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  /** The first message that was unread when the thread opened; stays put after it is marked read. */
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const live = useLiveState();
  const sourceRef = useRef(source);
  useEffect(() => {
    sourceRef.current = source;
  });
  const openedFor = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const c = await sourceRef.current.load(id);
      setConversation(c);
      setLoadError(null);
      if (openedFor.current !== id) {
        openedFor.current = id;
        setFirstUnreadId(firstUnread(c));
      }
      if (c.unread > 0) await sourceRef.current.markRead(id).catch(() => undefined);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    setConversation(null);
    setPending([]);
    setFirstUnreadId(null);
    openedFor.current = null;
    void refresh();
  }, [refresh]);

  useLiveEvents((e) => {
    if ((e.type === 'message.created' || e.type === 'conversation.updated') && e.data.conversationId === id) void refresh();
  }, !!id);

  // Fall back to polling whenever the live stream isn't open.
  useEffect(() => {
    if (!id || live === 'open') return;
    const t = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(t);
  }, [id, live, refresh]);

  const deliver = useCallback(
    async (p: PendingMessage) => {
      if (!id) return;
      setPending((list) => list.map((m) => (m.clientMessageId === p.clientMessageId ? { ...m, state: 'sending', error: undefined } : m)));
      try {
        const saved = await sourceRef.current.send(id, p.body, p.clientMessageId, p.internal);
        setConversation((c) =>
          c && !c.messages.some((m) => m.id === saved.id) ? { ...c, messages: [...c.messages, saved], lastMessageAt: saved.createdAt } : c,
        );
        setPending((list) => list.filter((m) => m.clientMessageId !== p.clientMessageId));
      } catch (e) {
        setPending((list) =>
          list.map((m) => (m.clientMessageId === p.clientMessageId ? { ...m, state: 'failed', error: errorMessage(e) } : m)),
        );
      }
    },
    [id],
  );

  const send = useCallback(
    (body: string, internal = false) => {
      const p: PendingMessage = { clientMessageId: clientId('m'), body, internal, state: 'sending', createdAt: Date.now() };
      setPending((list) => [...list, p]);
      void deliver(p);
    },
    [deliver],
  );

  const retry = useCallback(
    (clientMessageId: string) => {
      const p = pending.find((m) => m.clientMessageId === clientMessageId);
      if (p) void deliver(p);
    },
    [pending, deliver],
  );

  const discard = useCallback((clientMessageId: string) => {
    setPending((list) => list.filter((m) => m.clientMessageId !== clientMessageId));
  }, []);

  // A pending message the server already stored (e.g. the response was lost) is shown once, from the server.
  const visiblePending = useMemo(() => {
    const stored = new Set(conversation?.messages.map((m) => m.clientMessageId).filter(Boolean));
    return pending.filter((p) => !stored.has(p.clientMessageId));
  }, [pending, conversation]);

  return { conversation, setConversation, loadError, pending: visiblePending, firstUnreadId, send, retry, discard, refresh, live };
}

function firstUnread(c: Conversation): string | null {
  if (c.unread <= 0) return null;
  // `unread` counts the other side's messages since this side last read; walk back that many.
  let left = c.unread;
  for (let i = c.messages.length - 1; i >= 0; i--) {
    const m = c.messages[i]!;
    if (m.internal) continue;
    left -= 1;
    if (left === 0) return m.id;
  }
  return c.messages[0]?.id ?? null;
}
