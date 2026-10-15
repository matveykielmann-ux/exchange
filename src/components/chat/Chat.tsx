import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { BRAND } from '@/config/brand';
import { formatDateTime, formatTime } from '@/lib/format';
import type { LiveState, Message } from '@/services/types';
import { Icon } from '../Icon';
import type { PendingMessage } from './useChatThread';
import { t } from '@/i18n';

const LIVE_LABEL: Record<LiveState, string> = {
  open: 'Live',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting… (checking every 10 s)',
  offline: 'Offline (checking every 10 s)',
};

/** Shows whether new messages arrive live or by periodic refresh. */
export function LiveIndicator({ state }: { state: LiveState }) {
  return (
    <span className={`live-indicator live-indicator--${state}`} role="status">
      <span className="live-indicator__dot" aria-hidden="true" />
      {t(LIVE_LABEL[state])}
    </span>
  );
}

function sameDay(a: number, b: number) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function authorLabel(m: Message, viewer: 'customer' | 'staff') {
  if (m.authorKind === 'system') return t('{0} (automated)', [BRAND.name]);
  if (m.authorKind === 'customer') return t(viewer === 'customer' ? 'You' : 'Customer');
  if (viewer === 'customer') return t('{0} support', [BRAND.name]);
  return m.internal ? t('Internal note') : (m.authorName ?? t('Support team'));
}

/**
 * The message list for a support conversation. Stored messages come from the
 * server; pending ones are this browser's unsent messages, marked as sending
 * or failed with a retry.
 */
export function ChatMessages({
  messages,
  pending,
  viewer,
  firstUnreadId,
  onRetry,
  onDiscard,
}: {
  messages: Message[];
  pending: PendingMessage[];
  viewer: 'customer' | 'staff';
  firstUnreadId: string | null;
  onRetry(clientMessageId: string): void;
  onDiscard(clientMessageId: string): void;
}) {
  const end = useRef<HTMLDivElement>(null);
  const count = messages.length + pending.length;
  useLayoutEffect(() => {
    const el = end.current?.parentElement;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  return (
    <div className="chat-log" role="log" aria-live="polite" aria-relevant="additions" tabIndex={0} aria-label={t('Messages')}>
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const mine = viewer === 'customer' ? m.authorKind === 'customer' : m.authorKind === 'staff';
        return (
          <Fragment key={m.id}>
            {!prev || !sameDay(prev.createdAt, m.createdAt) ? (
              <p className="chat-day">
                {new Date(m.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            ) : null}
            {m.id === firstUnreadId ? (
              <p className="chat-unread-marker">
                <span>{t('New messages')}</span>
              </p>
            ) : null}
            <div className={`chat-msg ${mine ? 'chat-msg--mine' : ''} ${m.internal ? 'chat-msg--internal' : ''} chat-msg--${m.authorKind}`}>
              <p className="chat-msg__meta">
                <span>{authorLabel(m, viewer)}</span>
                <time dateTime={new Date(m.createdAt).toISOString()} title={formatDateTime(m.createdAt)}>
                  {formatTime(m.createdAt)}
                </time>
              </p>
              <p className="chat-msg__body">{m.body}</p>
              {mine ? <p className="chat-msg__state">{t('Sent')}</p> : null}
            </div>
          </Fragment>
        );
      })}
      {pending.map((p) => (
        <div key={p.clientMessageId} className={`chat-msg chat-msg--mine ${p.internal ? 'chat-msg--internal' : ''} chat-msg--pending`}>
          <p className="chat-msg__meta">
            <span>{viewer === 'customer' ? t('You') : p.internal ? t('Internal note') : t('You')}</span>
            <time dateTime={new Date(p.createdAt).toISOString()}>{formatTime(p.createdAt)}</time>
          </p>
          <p className="chat-msg__body">{p.body}</p>
          {p.state === 'sending' ? (
            <p className="chat-msg__state">{t('Sending…')}</p>
          ) : (
            <div className="chat-msg__failed" role="alert">
              <span>
                <Icon name="alert" width={14} height={14} /> {t('Not sent.')} {p.error}
              </span>
              <button type="button" className="link-button" onClick={() => onRetry(p.clientMessageId)}>
                {t('Retry')}
              </button>
              <button type="button" className="link-button" onClick={() => onDiscard(p.clientMessageId)}>
                {t('Discard')}
              </button>
            </div>
          )}
        </div>
      ))}
      {count === 0 ? <p className="muted small">{t('No messages yet.')}</p> : null}
      <div ref={end} />
    </div>
  );
}

export const MAX_MESSAGE = 4000;

/** Message box: Enter sends, Shift+Enter adds a line. Staff can switch to an internal note. */
export function ChatComposer({
  onSend,
  disabled,
  disabledReason,
  allowInternal = false,
  label = 'Message',
}: {
  onSend(body: string, internal: boolean): void;
  disabled?: boolean;
  disabledReason?: string;
  allowInternal?: boolean;
  label?: string;
}) {
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  const trimmed = body.trim();
  const tooLong = body.length > MAX_MESSAGE;

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!trimmed || tooLong || disabled) return;
    onSend(trimmed, internal);
    setBody('');
  }
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [body]);

  return (
    <form className={`chat-composer ${internal ? 'chat-composer--internal' : ''}`} onSubmit={submit}>
      {allowInternal ? (
        <div className="segmented" role="radiogroup" aria-label={t('Message type')}>
          <button type="button" role="radio" aria-checked={!internal} onClick={() => setInternal(false)}>
            {t('Reply to customer')}
          </button>
          <button type="button" role="radio" aria-checked={internal} onClick={() => setInternal(true)}>
            {t('Internal note')}
          </button>
        </div>
      ) : null}
      <label className="visually-hidden" htmlFor="chat-input">
        {label}
      </label>
      <div className="chat-composer__row">
        <textarea
          id="chat-input"
          ref={ref}
          className="textarea chat-composer__input"
          rows={1}
          value={body}
          placeholder={disabled ? disabledReason : internal ? t('Visible to staff only') : t('Write a message')}
          disabled={disabled}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          aria-invalid={tooLong || undefined}
          aria-describedby={tooLong ? 'chat-input-hint' : undefined}
        />
        <button type="submit" className="btn chat-composer__send" disabled={!trimmed || tooLong || disabled} aria-label={t('Send message')}>
          <Icon name="send" width={18} height={18} />
        </button>
      </div>
      {tooLong ? (
        <p id="chat-input-hint" className="small field__error">
          {t('Messages can be up to {0} characters.', [MAX_MESSAGE])}
        </p>
      ) : null}
    </form>
  );
}
