import { Fragment, useEffect, useMemo, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { LegalMarkdown, RulesQuote } from '@/components/LegalMarkdown';
import { Notice, PageHeader } from '@/components/ui';
import { BRAND, SUPPORT } from '@/config/brand';
import { TelegramLink } from '@/components/SupportContact';
import { getLegalDocument, LEGAL_DOCUMENTS, type LegalBlock, type LegalDocument } from '@/content/legal';
import { headingRanks, parseMarkdown, type MdBlock } from '@/content/legal/markdown';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useIsSandbox } from '@/state/config';
import { NotFoundPage } from './ContentPages';
import { getLang, t } from '@/i18n';

const fill = (text: string) =>
  text
    .replaceAll('{{brand}}', BRAND.name)
    .replaceAll('{{supportEmail}}', BRAND.supportEmail)
    .replaceAll('{{supportHours}}', SUPPORT.hours.label);

/** Paragraph text with {{supportTelegram}} rendered as the official Telegram link. */
function Filled({ text }: { text: string }) {
  const parts = fill(text).split('{{supportTelegram}}');
  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 ? <TelegramLink /> : null}
    </Fragment>
  ));
}

const ACCEPTANCE_LABEL: Record<NonNullable<LegalDocument['acceptance']>, string> = {
  signup: 'Accepted when you create an account',
  order: 'Accepted with each order',
};

const hasReviewItems = (doc: LegalDocument) => doc.sections.some((s) => s.blocks.some((b) => b.type === 'review'));

/** Table-of-contents entries for a Markdown document: its second heading level (the first is the document title). */
function markdownToc(blocks: MdBlock[]) {
  const level = headingRanks(blocks)[1];
  return blocks.flatMap((b) => (b.type === 'heading' && b.level === level ? [{ id: b.id, heading: b.text }] : []));
}

/**
 * Reviewer notes on a supplied document (for example where its text and the
 * Service's behavior differ). Sandbox only, collapsed, and kept outside the
 * document text so the document itself is shown exactly as supplied.
 */
function ReviewNotes({ doc, sandbox }: { doc: LegalDocument; sandbox: boolean }) {
  if (!sandbox || !doc.reviewNotes?.length) return null;
  return (
    <details className="legal-notes">
      <summary>
        {t('Reviewer notes:')} {doc.reviewNotes.length}{' '}
        {t('points where this document and the current site differ or details are missing (shown in the sandbox only)')}
      </summary>
      <ul>
        {doc.reviewNotes.map((n) => (
          <li key={n.id} className="legal-review">
            <span className="legal-review__id">{n.id}</span> {n.text}
          </li>
        ))}
      </ul>
    </details>
  );
}

function formatIsoDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Index of every customer-facing legal document, with its version and when it is accepted. */
export function LegalIndexPage() {
  useDocumentTitle('Legal');
  const sandbox = useIsSandbox();
  return (
    <>
      <PageHeader
        eyebrow={t('Legal')}
        title={t('Legal documents.')}
        lead={t(
          'The terms, policies and disclosures that apply to your account and your orders. Each one is versioned, and we keep a record of the version you accepted.',
        )}
      />
      <div className="container section--tight stack stack--lg" style={{ maxWidth: 'calc(960px + 2 * var(--gutter))' }}>
        <EnglishOnlyNotice />
        <PendingReviewNotice sandbox={sandbox} />
        <ul className="legal-index">
          {LEGAL_DOCUMENTS.map((d) => (
            <li key={d.slug} className="panel">
              <Link to={`/legal/${d.slug}`} className="legal-index__link">
                <span className="title">{d.title}</span>
                <span className="muted small">{fill(d.summary)}</span>
                <span className="legal-index__meta small">
                  <span>
                    {t('Version')} {d.version}
                  </span>
                  {d.acceptance ? <span>{t(ACCEPTANCE_LABEL[d.acceptance])}</span> : <span>{t('For your information')}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/** Legal documents are not translated: in Russian the interface says so, and the English text stays binding. */
function EnglishOnlyNotice() {
  if (getLang() !== 'ru') return null;
  return <Notice tone="info" title={t('Legal documents are published in English. The English text is the binding version.')} />;
}

/**
 * Shown only for documents that are not yet in effect or that still contain
 * unresolved in-document review callouts. Owner-accepted documents with an
 * effective date and no review blocks do not show a draft banner.
 * This is not a claim of counsel approval.
 */
function PendingReviewNotice({ sandbox, doc }: { sandbox: boolean; doc?: LegalDocument }) {
  if (doc) {
    if (doc.effectiveDate && !hasReviewItems(doc)) return null;
  } else {
    // Index: hide the draft banner when every document has an effective date and no review items.
    const anyPending = LEGAL_DOCUMENTS.some((d) => !d.effectiveDate || hasReviewItems(d));
    if (!anyPending) return null;
  }
  return (
    <Notice tone="warn" title={t('Pending legal review')}>
      <p>
        {doc
          ? t(
              doc.effectiveDate
                ? 'This document is a draft awaiting review by counsel and may change before it takes effect.'
                : 'This document is a draft awaiting review by counsel and has no effective date yet.',
            )
          : t('These documents are drafts awaiting review by counsel and have no effective date yet.')}{' '}
        {sandbox
          ? t('Highlighted notes mark facts the owner or counsel still has to supply.')
          : t('Some details are still to be confirmed.')}
      </p>
    </Notice>
  );
}

function Block({ block, sandbox }: { block: LegalBlock; sandbox: boolean }): ReactNode {
  switch (block.type) {
    case 'p':
      return (
        <p>
          <Filled text={block.text} />
        </p>
      );
    case 'list': {
      const items = block.items.map((item, i) => (
        <li key={i}>
          <Filled text={item} />
        </li>
      ));
      return block.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
    }
    case 'rules':
      return <RulesQuote refs={block.refs} />;
    case 'review':
      // Unresolved facts are shown to reviewers in the sandbox only; production pages omit them.
      return sandbox ? (
        <aside className="legal-review" aria-label={t('Review item {0}', [block.id])}>
          <span className="legal-review__id">{block.id}</span> {block.text}
        </aside>
      ) : null;
  }
}

/** One legal document, rendered from the versioned content in src/content/legal. */
export function LegalDocumentPage() {
  const { slug = '' } = useParams();
  const doc = getLegalDocument(slug);
  useDocumentTitle(doc?.title ?? 'Legal');
  const sandbox = useIsSandbox();
  const blocks = useMemo(() => (doc?.markdown ? parseMarkdown(doc.markdown) : null), [doc]);
  const { hash } = useLocation();
  // Links such as "/legal/terms#clause-4-11" can arrive before this lazily loaded page has rendered; scroll once it has.
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [hash, doc]);
  if (!doc) return <NotFoundPage />;
  const toc = blocks ? markdownToc(blocks) : doc.sections.map((s) => ({ id: s.id, heading: s.heading }));
  return (
    <>
      <PageHeader eyebrow={t('Legal')} title={doc.title} lead={fill(doc.summary)}>
        <dl className="legal-meta">
          <div>
            <dt>{t('Version')}</dt>
            <dd>{doc.version}</dd>
          </div>
          <div>
            <dt>{t('Effective')}</dt>
            <dd>
              {doc.effectiveDate
                ? t('In effect from {0}', [formatIsoDate(doc.effectiveDate)])
                : t('Not yet in effect')}
            </dd>
          </div>
          <div>
            <dt>{t('Last updated')}</dt>
            <dd>{formatIsoDate(doc.lastUpdated)}</dd>
          </div>
          <div>
            <dt>{t('Acceptance')}</dt>
            <dd>{doc.acceptance ? t(ACCEPTANCE_LABEL[doc.acceptance]) : t('For your information')}</dd>
          </div>
        </dl>
      </PageHeader>
      <div className="container content-grid">
        <nav className="toc" aria-label={t('On this page')}>
          <p className="eyebrow">{t('On this page')}</p>
          {toc.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.heading}
            </a>
          ))}
          <Link to="/legal" className="toc__back">
            {t('All legal documents')}
          </Link>
        </nav>
        <article className={blocks ? 'prose prose--legal-md' : 'prose'}>
          <EnglishOnlyNotice />
          <PendingReviewNotice sandbox={sandbox} doc={doc} />
          <ReviewNotes doc={doc} sandbox={sandbox} />
          {blocks ? <LegalMarkdown blocks={blocks} label={doc.title} /> : null}
          {doc.sections.map((s) => (
            <Fragment key={s.id}>
              <h2 id={s.id}>{s.heading}</h2>
              {s.blocks.map((b, i) => (
                <Block key={i} block={b} sandbox={sandbox} />
              ))}
            </Fragment>
          ))}
        </article>
      </div>
    </>
  );
}
