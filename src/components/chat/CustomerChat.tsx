import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ORDER_STATUS_LABEL } from '@/domain/order';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { clientId } from '@/services/http';
import type { Conversation, ConversationSummary, OrderSummary } from '@/services/types';
import { useServices } from '@/state/services';
import { Notice } from '../ui';
import { ChatComposer, ChatMessages, LiveIndicator, MAX_MESSAGE } from './Chat';
import { CONVERSATION_STATUS_LABEL } from './conversations';
import { useChatThread } from './useChatThread';

export function ConversationList({
  list,
  activeId,
  onOpen,
}: {
  list: ConversationSummary[];
  activeId?: string | null;
  onOpen(id: string): void;
}) {
  if (!list.length) return <p className="muted small">No conversations yet.</p>;
  return (
    <ul className="conv-list">
      {list.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            className={`conv-item ${c.unread ? 'conv-item--unread' : ''}`}
            aria-current={activeId === c.id ? 'true' : undefined}
            onClick={() => onOpen(c.id)}
          >
            <span className="conv-item__top">
              <span className="conv-item__subject">{c.subject}</span>
              {c.unread ? (
                <span className="unread-pill" aria-label={`${c.unread} unread`}>
                  {c.unread}
                </span>
              ) : null}
            </span>
            <span className="conv-item__preview">
              {c.lastMessage ? `${c.lastMessage.authorKind === 'customer' ? 'You: ' : ''}${c.lastMessage.body}` : 'No messages'}
            </span>
            <span className="conv-item__meta">
              <span>{CONVERSATION_STATUS_LABEL[c.status]}</span>
              {c.order ? <span>Order {c.order.reference}</span> : null}
              <time dateTime={new Date(c.lastMessageAt).toISOString()}>{formatDateTime(c.lastMessageAt)}</time>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** One conversation with the support team: history, live updates and the message box. */
export function CustomerThread({ id, compact = false }: { id: string; compact?: boolean }) {
  const { support } = useServices();
  const t = useChatThread<Conversation>(id, {
    load: (cid) => support.get(cid),
    send: (cid, body, cmid) => support.send(cid, body, cmid),
    markRead: (cid) => support.markRead(cid),
  });
  if (t.loadError && !t.conversation)
    return (
      <Notice tone="danger" title="This conversation could not be loaded." role="alert">
        {t.loadError}
      </Notice>
    );
  if (!t.conversation) return <p className="muted">Loading conversation…</p>;
  const c = t.conversation;
  return (
    <div className={`chat ${compact ? 'chat--compact' : ''}`}>
      <div className="chat__head">
        <div>
          <h2 className="title chat__subject">{c.subject}</h2>
          <p className="small muted">
            {CONVERSATION_STATUS_LABEL[c.status]}
            {c.order ? (
              <>
                {' · '}
                <Link to={`/orders/${c.order.id}`}>
                  Order {c.order.reference} ({ORDER_STATUS_LABEL[c.order.status]})
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <LiveIndicator state={t.live} />
      </div>
      <ChatMessages
        messages={c.messages}
        pending={t.pending}
        viewer="customer"
        firstUnreadId={t.firstUnreadId}
        onRetry={t.retry}
        onDiscard={t.discard}
      />
      {c.status === 'resolved' ? (
        <p className="small muted chat__note">This conversation is resolved. Sending a message reopens it.</p>
      ) : null}
      <ChatComposer onSend={(body) => t.send(body)} />
    </div>
  );
}

/** Starts a conversation, optionally about one of the customer's orders. */
export function NewConversationForm({
  defaultOrderId = null,
  onCreated,
  compact = false,
}: {
  defaultOrderId?: string | null;
  onCreated(c: Conversation): void;
  compact?: boolean;
}) {
  const { support, orders } = useServices();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [orderId, setOrderId] = useState<string>(defaultOrderId ?? '');
  const [recent, setRecent] = useState<OrderSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One id per drafted conversation, so a retry after a dropped response doesn't open a second one.
  const [cmid, setCmid] = useState(() => clientId('m'));

  useEffect(() => {
    let cancelled = false;
    orders
      .list(1)
      .then((p) => !cancelled && setRecent(p.items))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [orders]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) {
      setError('Add a subject and a message.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const c = await support.create({ subject: subject.trim(), body: body.trim(), orderId: orderId || null, clientMessageId: cmid });
      setCmid(clientId('m'));
      setSubject('');
      setBody('');
      onCreated(c);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const prefix = compact ? 'w' : 'p';
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <div className="field">
        <label className="field__label" htmlFor={`${prefix}-subject`}>
          Subject
        </label>
        <input id={`${prefix}-subject`} className="input" maxLength={140} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div className="field">
        <label className="field__label" htmlFor={`${prefix}-order`}>
          About an order (optional)
        </label>
        <select id={`${prefix}-order`} className="select" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
          <option value="">Not about a specific order</option>
          {recent.map((o) => (
            <option key={o.id} value={o.id}>
              {o.reference} · {ORDER_STATUS_LABEL[o.status]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="field__label" htmlFor={`${prefix}-body`}>
          Message
        </label>
        <textarea
          id={`${prefix}-body`}
          className="textarea"
          rows={compact ? 3 : 5}
          maxLength={MAX_MESSAGE}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <p className="field__hint">Never share passwords, seed phrases, private keys or full card numbers.</p>
      </div>
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
      <div>
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Sending…' : 'Send to support'}
        </button>
      </div>
    </form>
  );
}
