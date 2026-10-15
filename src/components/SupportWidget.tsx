import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useMatch } from 'react-router-dom';
import { isStaff, useUser } from '@/state/auth';
import { useCustomerConversations } from './chat/conversations';
import { ConversationList, CustomerThread, NewConversationForm } from './chat/CustomerChat';
import { Icon } from './Icon';
import { t } from '@/i18n';

type View = { kind: 'list' } | { kind: 'thread'; id: string } | { kind: 'new' };

/**
 * Floating support launcher on every customer page. Signed-in customers see
 * their conversations, unread counts and a message box; everyone else gets
 * a way to sign in. Hidden on the full support pages.
 */
export function SupportLauncher() {
  const user = useUser();
  const location = useLocation();
  const orderMatch = useMatch('/orders/:id');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ kind: 'list' });
  const customer = !!user && !isStaff(user);
  const { list } = useCustomerConversations(customer);
  const unread = (list ?? []).reduce((n, c) => n + c.unread, 0);
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    panel.current?.querySelector<HTMLElement>('h2')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Close the panel on navigation (state derived from the previous path, not an effect).
  const [path, setPath] = useState(location.pathname);
  if (path !== location.pathname) {
    setPath(location.pathname);
    setOpen(false);
  }

  if (location.pathname.startsWith('/support') || (user && isStaff(user))) return null;

  return (
    <div className="support-launcher">
      {open ? (
        <div className="support-panel" ref={panel} role="dialog" aria-modal="false" aria-labelledby="support-panel-title">
          <div className="support-panel__head">
            {view.kind !== 'list' ? (
              <button
                type="button"
                className="btn btn--ghost support-panel__back"
                onClick={() => setView({ kind: 'list' })}
                aria-label={t('Back to conversations')}
              >
                <Icon name="arrowLeft" width={16} height={16} />
              </button>
            ) : null}
            <h2 id="support-panel-title" className="title" tabIndex={-1}>
              {view.kind === 'new' ? t('New message') : t('Support')}
            </h2>
            <button
              type="button"
              className="btn btn--ghost"
              aria-label={t('Close support')}
              onClick={() => {
                setOpen(false);
                button.current?.focus();
              }}
            >
              <Icon name="x" width={16} height={16} />
            </button>
          </div>
          <div className="support-panel__body">
            {!user ? (
              <div className="stack">
                <p>{t('Sign in to message our support team. Your conversations are saved to your account.')}</p>
                <div className="row">
                  <Link className="btn" to="/signin" state={{ from: location.pathname }}>
                    {t('Sign in')}
                  </Link>
                  <Link className="btn btn--secondary" to="/help">
                    {t('Help center')}
                  </Link>
                </div>
              </div>
            ) : view.kind === 'thread' ? (
              <CustomerThread id={view.id} compact />
            ) : view.kind === 'new' ? (
              <NewConversationForm
                compact
                defaultOrderId={orderMatch?.params.id ?? null}
                onCreated={(c) => setView({ kind: 'thread', id: c.id })}
              />
            ) : (
              <div className="stack">
                <button type="button" className="btn btn--block" onClick={() => setView({ kind: 'new' })}>
                  <Icon name="chat" width={16} height={16} /> {t('New message')}
                </button>
                {list ? (
                  <ConversationList list={list.slice(0, 6)} onOpen={(id) => setView({ kind: 'thread', id })} />
                ) : (
                  <p className="muted small">{t('Loading…')}</p>
                )}
                <Link to="/support" className="small">
                  {t('Open all conversations')}
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
      <button
        ref={button}
        type="button"
        className="support-launcher__button"
        aria-expanded={open}
        aria-label={unread ? t('Support, {0} unread', [unread]) : t('Support')}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name={open ? 'x' : 'chat'} width={22} height={22} />
        {unread && !open ? <span className="support-launcher__badge">{unread}</span> : null}
      </button>
    </div>
  );
}
