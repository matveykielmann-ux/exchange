import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChatComposer, ChatMessages, LiveIndicator } from '@/components/chat/Chat';
import { CONVERSATION_STATUS_LABEL } from '@/components/chat/conversations';
import { useChatThread } from '@/components/chat/useChatThread';
import { Icon } from '@/components/Icon';
import { Notice, StatusBadge } from '@/components/ui';
import { ORDER_STATUS_LABEL, orderTone, type OrderStatus } from '@/domain/order';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import type { StaffConversation, StaffMember } from '@/services/adminTypes';
import type { ConversationStatus } from '@/services/types';
import { useUser } from '@/state/auth';
import { useServices } from '@/state/services';
import { useLiveEvents } from '@/state/useLive';
import { AdminHead, LoadError, Pager } from './shared';
import { useLoad } from './lib';
import { t } from '@/i18n';

function Thread({ id, staff, onChanged }: { id: string; staff: StaffMember[]; onChanged(): void }) {
  const { admin } = useServices();
  const thread = useChatThread<StaffConversation>(id, {
    load: (cid) => admin.conversation(cid),
    send: (cid, body, cmid, internal) => admin.reply(cid, body, internal, cmid),
    markRead: (cid) => admin.markConversationRead(cid),
  });
  const [err, setErr] = useState<string | null>(null);
  const byId = useMemo(() => new Map(staff.map((s) => [s.id, s.email])), [staff]);

  if (thread.loadError && !thread.conversation)
    return (
      <Notice tone="danger" title={t('This conversation could not be loaded.')} role="alert">
        {thread.loadError}
      </Notice>
    );
  if (!thread.conversation) return <p className="muted">{t('Loading conversation…')}</p>;
  const c = thread.conversation;
  const messages = c.messages.map((m) =>
    m.authorKind === 'staff' && m.authorId ? { ...m, authorName: byId.get(m.authorId) ?? 'Staff' } : m,
  );

  const update = async (fn: () => Promise<StaffConversation>) => {
    setErr(null);
    try {
      const next = await fn();
      thread.setConversation((prev) => (prev ? { ...next, messages: prev.messages } : next));
      onChanged();
    } catch (e) {
      setErr(errorMessage(e));
    }
  };

  return (
    <div className="inbox-thread">
      <div className="chat chat--staff">
        <div className="chat__head">
          <div>
            <h2 className="title chat__subject">{c.subject}</h2>
            <p className="small muted">
              {c.customer ? `${c.customer.name || 'Customer'} · ${c.customer.email}` : null}
              {c.order ? (
                <>
                  {' · '}
                  <Link to={`/admin/orders/${c.order.id}`}>
                    {t('Order')} {c.order.reference}
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          <LiveIndicator state={thread.live} />
        </div>
        <ChatMessages
          messages={messages}
          pending={thread.pending}
          viewer="staff"
          firstUnreadId={thread.firstUnreadId}
          onRetry={thread.retry}
          onDiscard={thread.discard}
        />
        <span />
        <ChatComposer allowInternal onSend={(body, internal) => thread.send(body, internal)} />
      </div>
      <aside className="inbox-side stack">
        <div className="field">
          <label className="field__label" htmlFor="cv-status">
            {t('Status')}
          </label>
          <select
            id="cv-status"
            className="select"
            value={c.status}
            onChange={(e) => update(() => admin.setConversationStatus(c.id, e.target.value as ConversationStatus))}
          >
            <option value="open">{t('Open')}</option>
            <option value="pending">{t('Waiting on customer')}</option>
            <option value="resolved">{t('Resolved')}</option>
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="cv-assign">
            {t('Assigned to')}
          </label>
          <select
            id="cv-assign"
            className="select"
            value={c.assignedOperatorId ?? ''}
            onChange={(e) => update(() => admin.assignConversation(c.id, e.target.value || null))}
          >
            <option value="">{t('Unassigned')}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.email}
              </option>
            ))}
          </select>
        </div>
        {err ? (
          <p className="field__error" role="alert">
            {err}
          </p>
        ) : null}
        <div className="stack" style={{ gap: 6 }}>
          <p className="field__label">{t('Customer')}</p>
          <p className="small">
            {t('Verification:')} {c.customerContext.kycStatus}
            <br />
            {t('State:')} {c.customerContext.stateOfResidence ?? '—'}
          </p>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <p className="field__label">{t('Recent orders')}</p>
          {c.customerContext.recentOrders.length ? (
            <ul className="link-list">
              {c.customerContext.recentOrders.map((o) => (
                <li key={o.id}>
                  <Link to={`/admin/orders/${o.id}`} className="mono small">
                    {o.reference}
                  </Link>{' '}
                  <StatusBadge tone={orderTone(o.status as OrderStatus)}>{t(ORDER_STATUS_LABEL[o.status as OrderStatus])}</StatusBadge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">{t('None.')}</p>
          )}
        </div>
        <p className="small muted">{t('Internal notes are stored with the conversation and are never shown to the customer.')}</p>
      </aside>
    </div>
  );
}

/** Support inbox: every customer conversation, with filters, assignment, internal notes and unread markers. */
export function InboxPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const me = useUser();
  const { admin } = useServices();
  const [params, setParams] = useSearchParams();
  const status = (['open', 'pending', 'resolved'] as const).find((s) => s === params.get('status')) ?? 'all';
  const assigned = params.get('assigned') === 'me' ? 'me' : params.get('assigned') === 'unassigned' ? 'unassigned' : 'any';
  const unread = params.get('unread') === 'true';
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const key = params.toString();
  const list = useLoad(() => admin.inbox({ status, assigned, unread, q, page }), [key]);
  const staff = useLoad(() => admin.staff(), []);
  useLiveEvents((e) => {
    if (e.type === 'conversation.updated' || e.type === 'message.created') list.reload();
  });
  const [search, setSearch] = useState(q);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };
  const qsSuffix = key ? `?${key}` : '';

  return (
    <div className="stack stack--lg">
      <AdminHead
        title={t('Support inbox')}
        lead={t('Conversations are stored on the server; replies reach the customer’s account immediately.')}
      />
      <form
        className="filters"
        role="search"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          set({ q: search.trim() || null });
        }}
      >
        <div className="field filters__search">
          <label className="field__label" htmlFor="inbox-q">
            {t('Search')}
          </label>
          <div className="input-with-button">
            <input
              id="inbox-q"
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Subject, email, order reference')}
            />
            <button type="submit" className="btn btn--secondary" aria-label={t('Search')}>
              <Icon name="search" width={18} height={18} />
            </button>
          </div>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="inbox-status">
            {t('Status')}
          </label>
          <select
            id="inbox-status"
            className="select"
            value={status}
            onChange={(e) => set({ status: e.target.value === 'all' ? null : e.target.value })}
          >
            <option value="all">{t('All')}</option>
            <option value="open">{t('Open')}</option>
            <option value="pending">{t('Waiting on customer')}</option>
            <option value="resolved">{t('Resolved')}</option>
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="inbox-assigned">
            {t('Assigned')}
          </label>
          <select
            id="inbox-assigned"
            className="select"
            value={assigned}
            onChange={(e) => set({ assigned: e.target.value === 'any' ? null : e.target.value })}
          >
            <option value="any">{t('Anyone')}</option>
            <option value="me">{t('Me')}</option>
            <option value="unassigned">{t('Unassigned')}</option>
          </select>
        </div>
        <label className="check filters__check" htmlFor="inbox-unread">
          <input id="inbox-unread" type="checkbox" checked={unread} onChange={(e) => set({ unread: e.target.checked ? 'true' : null })} />
          <span>{t('Unread only')}</span>
        </label>
      </form>
      <LoadError error={list.error} />
      <div className="inbox">
        <div className="inbox-list panel">
          <div className="panel__body">
            {list.data ? (
              list.data.items.length ? (
                <ul className="conv-list">
                  {list.data.items.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`conv-item ${c.unread ? 'conv-item--unread' : ''}`}
                        aria-current={id === c.id ? 'true' : undefined}
                        onClick={() => navigate(`/admin/inbox/${c.id}${qsSuffix}`)}
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
                          {c.lastMessage
                            ? `${c.lastMessage.internal ? '[note] ' : c.lastMessage.authorKind === 'staff' ? 'Staff: ' : ''}${c.lastMessage.body}`
                            : ''}
                        </span>
                        <span className="conv-item__meta">
                          <span>{t(CONVERSATION_STATUS_LABEL[c.status])}</span>
                          <span>{c.customer?.email}</span>
                          {c.assignedOperatorId ? (
                            <span>{c.assignedOperatorId === me?.id ? t('Mine') : t('Assigned')}</span>
                          ) : (
                            <span>{t('Unassigned')}</span>
                          )}
                          <time dateTime={new Date(c.lastMessageAt).toISOString()}>{formatDateTime(c.lastMessageAt)}</time>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small muted">{t('No conversations match.')}</p>
              )
            ) : !list.error ? (
              <p className="small muted">{t('Loading…')}</p>
            ) : null}
            {list.data && list.data.total > list.data.pageSize ? (
              <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={(p) => set({ page: String(p) })} />
            ) : null}
          </div>
        </div>
        <div className="panel inbox-main">
          <div className="panel__body">
            {id ? (
              <Thread key={id} id={id} staff={staff.data ?? []} onChanged={list.reload} />
            ) : (
              <p className="muted">{t('Choose a conversation.')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
