import { createElement, Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { headingRanks, inlineText, type MdBlock, type MdInline } from '@/content/legal/markdown';
import { rulesExcerpt } from '@/content/legal/rules';

/** Internal links ("/en/privacy-policy") stay in the app; anything with a scheme opens in a new tab. */
function MdLink({ href, children }: { href: string; children: ReactNode }) {
  if (href.startsWith('/')) return <Link to={href}>{children}</Link>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}

function Inline({ nodes }: { nodes: MdInline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case 'text':
            return <Fragment key={i}>{n.text}</Fragment>;
          case 'br':
            return <br key={i} />;
          case 'strong':
            return (
              <strong key={i}>
                <Inline nodes={n.children} />
              </strong>
            );
          case 'link':
            return (
              <MdLink key={i} href={n.href}>
                <Inline nodes={n.children} />
              </MdLink>
            );
        }
      })}
    </>
  );
}

/** Accessible name for a table: the paragraph that introduces it, or the document's name. */
function tableLabel(blocks: MdBlock[], index: number, fallback: string) {
  const prev = blocks[index - 1];
  return prev?.type === 'paragraph' ? inlineText(prev.children).replace(/:\s*$/, '') : fallback;
}

/**
 * Renders a legal document parsed from Markdown. Every block of the source is
 * rendered; nothing is summarized. The first heading level becomes <h2> (the
 * page itself has the <h1>), the next <h3>, so the outline has no gaps.
 */
export function LegalMarkdown({ blocks, label, anchors = true }: { blocks: MdBlock[]; label: string; anchors?: boolean }) {
  const ranks = headingRanks(blocks);
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading': {
            const rank = ranks.indexOf(b.level);
            return createElement(
              `h${Math.min(2 + rank, 6)}`,
              { key: i, id: anchors ? b.id : undefined, className: rank === 0 ? 'legal-md__title' : 'legal-md__heading' },
              <Inline nodes={b.children} />,
            );
          }
          case 'paragraph':
            return (
              <p key={i} id={anchors ? b.id : undefined}>
                <Inline nodes={b.children} />
              </p>
            );
          case 'list':
            return (
              <ul key={i}>
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Inline nodes={item} />
                  </li>
                ))}
              </ul>
            );
          case 'table':
            return (
              <div key={i} className="table-wrap" tabIndex={0} role="region" aria-label={tableLabel(blocks, i, label)}>
                <table className="data-table legal-md__table">
                  <thead>
                    <tr>
                      {b.head.map((cell, j) => (
                        <th key={j} scope="col" style={{ textAlign: b.align[j] ?? 'left' }}>
                          <Inline nodes={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, j) => (
                          <td key={j} style={{ textAlign: b.align[j] ?? 'left' }}>
                            <Inline nodes={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </>
  );
}

/**
 * Quotes clauses or sections of the Service Rules word for word, with a link
 * to each one on the full Rules page. Used wherever another page states a rule.
 */
export function RulesQuote({ refs }: { refs: string[] }) {
  const parts = refs.map(rulesExcerpt);
  return (
    <figure className="rules-quote">
      <blockquote cite="/legal/terms">
        {parts.map((p) => (
          <LegalMarkdown key={p.ref} blocks={p.blocks} label={`Service Rules, ${p.label}`} anchors={false} />
        ))}
      </blockquote>
      <figcaption>
        Service Rules,{' '}
        {parts.map((p, i) => (
          <Fragment key={p.ref}>
            {i > 0 ? (i === parts.length - 1 ? ' and ' : ', ') : null}
            <Link to={`/legal/terms#${p.anchor}`}>{p.label}</Link>
          </Fragment>
        ))}
      </figcaption>
    </figure>
  );
}
