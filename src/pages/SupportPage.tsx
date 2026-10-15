import { useNavigate, useParams } from 'react-router-dom';
import { useCustomerConversations } from '@/components/chat/conversations';
import { ConversationList, CustomerThread, NewConversationForm } from '@/components/chat/CustomerChat';
import { Notice } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { t } from '@/i18n';

/** Customer support center: every conversation with the team, stored on the server. */
export function SupportPage() {
  useDocumentTitle('Support messages');
  const { id } = useParams();
  const navigate = useNavigate();
  const { list, error, reload } = useCustomerConversations();
  const isNew = id === 'new';

  return (
    <div className="container section--tight support-page">
      <div className="section-head">
        <div>
          <p className="eyebrow">{t('Support')}</p>
          <h1 className="display-m">{t('Messages')}</h1>
          <p className="muted">{t('Our team replies here. Conversations stay in your account; you can link one to an order.')}</p>
        </div>
      </div>
      <div className="support-layout">
        <aside className="panel support-layout__list" aria-label={t('Conversations')}>
          <div className="panel__body stack">
            <button type="button" className="btn btn--block" onClick={() => navigate('/support/new')}>
              {t('New message')}
            </button>
            {error ? (
              <Notice tone="danger" title={t('Conversations could not be loaded.')} role="alert">
                {error}
              </Notice>
            ) : null}
            {list ? (
              <ConversationList list={list} activeId={id} onOpen={(cid) => navigate(`/support/${cid}`)} />
            ) : (
              <p className="muted small">{t('Loading…')}</p>
            )}
          </div>
        </aside>
        <section className="panel support-layout__thread" aria-label={t('Conversation')}>
          <div className="panel__body">
            {isNew || (!id && list && list.length === 0) ? (
              <div className="stack">
                <h2 className="title">{t('Start a conversation')}</h2>
                <NewConversationForm
                  onCreated={(c) => {
                    void reload();
                    navigate(`/support/${c.id}`, { replace: true });
                  }}
                />
              </div>
            ) : id ? (
              <CustomerThread id={id} />
            ) : (
              <p className="muted">{t('Choose a conversation, or start a new one.')}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
