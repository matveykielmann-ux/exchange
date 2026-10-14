import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createFakeServices } from '@/test/fakeServices';
import { ServicesProvider } from '@/state/services';
import { SERVICE_RULES } from '@/content/legal/terms';
import { LEGAL_DOCUMENTS } from '@/content/legal';
import source from '@/content/legal/source/CRYPTOBIT_EXCHANGE_SERVICE_RULES.md?raw';
import { blocksText, parseMarkdown } from '@/content/legal/markdown';
import { AppRoutes } from '@/App';
import { LegalDocumentPage } from './LegalPages';

/**
 * Plain text of the source, derived independently of the app's parser: strip
 * Markdown markers only (heading hashes, list dashes, bold asterisks, link
 * targets, table pipes and the alignment row, trailing backslashes).
 */
function sourcePlainText(md: string) {
  return md
    .split('\n')
    .filter((line) => !/^\s*\|(\s*:?-+:?\s*\|)+\s*$/.test(line))
    .map((line) =>
      line
        .replace(/^#+\s+/, '')
        .replace(/^-\s+/, '')
        .replace(/\\$/, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\*\*/g, '')
        .replace(/\|/g, ' '),
    )
    .join(' ');
}

const words = (text: string) => text.replace(/\s+/g, ' ').trim().split(' ');

function renderRules(path = '/legal/terms') {
  return render(
    <ServicesProvider services={createFakeServices()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/legal/:slug" element={<LegalDocumentPage />} />
        </Routes>
      </MemoryRouter>
    </ServicesProvider>,
  );
}

describe('Service Rules page', () => {
  // The byte-for-byte check of the file itself is in server/__tests__/legal-source.test.ts (it needs Node's fs).
  it('uses the supplied file as the page source', () => {
    expect(SERVICE_RULES.markdown).toBe(source);
  });

  it('renders every word of the source document, in order', () => {
    const { container } = renderRules();
    const article = container.querySelector('article')!.cloneNode(true) as HTMLElement;
    // Remove page chrome that is not part of the document: reviewer notes and screen-reader link hints.
    article.querySelectorAll('.legal-notes, .notice, .visually-hidden').forEach((n) => n.remove());
    // Block elements end a word; jsdom's textContent would run "Panama." and "17." together.
    article.querySelectorAll('h2, h3, p, li, th, td, br').forEach((n) => n.after(' '));
    expect(words(article.textContent ?? '')).toEqual(words(sourcePlainText(source)));
  });

  it('the parser itself loses nothing', () => {
    expect(words(blocksText(parseMarkdown(source)))).toEqual(words(sourcePlainText(source)));
  });

  it('keeps headings, clauses, lists, the confirmations table and links', () => {
    const { container } = renderRules();
    const article = container.querySelector('article')!;
    const sourceHeadings = source
      .split('\n')
      .filter((l: string) => /^#+\s/.test(l))
      .map((l: string) => l.replace(/^#+\s+/, ''));
    const headings = [...article.querySelectorAll('h2, h3')].map((h) => h.textContent);
    expect(headings).toEqual(sourceHeadings);
    expect(headings).toHaveLength(19); // title, the public-offer line and Sections 1 to 17

    const clauses = source.match(/^\d+\.\d+\.\s/gm)!;
    const renderedClauses = [...article.querySelectorAll('p')].filter((p) => /^\d+\.\d+\.\s/.test(p.textContent ?? ''));
    expect(renderedClauses).toHaveLength(clauses.length);

    const bullets = source.match(/^- /gm)!;
    expect(article.querySelectorAll('li:not(.legal-review)')).toHaveLength(bullets.length);

    const table = within(article).getByRole('table');
    const rows = within(table)
      .getAllByRole('row')
      .map((r) => r.textContent);
    expect(rows).toEqual([
      'CryptocurrencyConfirmations',
      'BTC (Bitcoin)4',
      'ETH (Ethereum)21',
      'USDT (TRC-20, ERC-20, BEP-20)21',
      'USDC (TRC-20, ERC-20, BEP-20)21',
    ]);

    const sourceLinks = [...source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((m) => m[1]);
    const links = [...article.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(sourceLinks);
    for (const a of article.querySelectorAll('a[href^="http"]')) expect(a).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('lists every section in the table of contents', () => {
    renderRules();
    const toc = screen.getByRole('navigation', { name: 'On this page' });
    const entries = within(toc)
      .getAllByRole('link')
      .map((a) => a.textContent);
    expect(entries.slice(0, 2)).toEqual(['PUBLIC OFFER OF THE CryptoBit Exchange SERVICE', '1. Definitions']);
    expect(entries).toContain('17. Amendments');
  });
});

describe('links used by the Service Rules', () => {
  it.each([
    ['/en/kyc-aml-policy', 'Identity Verification and AML/KYC Notice'],
    ['/en/privacy-policy', 'Privacy Policy'],
  ])('%s opens an existing page', async (path, title) => {
    render(
      <ServicesProvider services={createFakeServices()}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </ServicesProvider>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });
});

describe('in-page links to legal documents', () => {
  it('every "/legal/<slug>#<id>" link in the app points at an existing document and anchor', () => {
    const files = import.meta.glob(['/src/**/*.{ts,tsx}', '!/src/**/*.test.{ts,tsx}'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    const rules = parseMarkdown(source);
    const ruleIds = new Set(rules.flatMap((b) => ('id' in b && b.id ? [b.id] : [])));
    const links = Object.values(files).flatMap((code) => [...code.matchAll(/\/legal\/([a-z-]+)#([a-z0-9-]+)/g)]);
    expect(links.length).toBeGreaterThan(5);
    for (const [link, slug, id] of links) {
      const doc = LEGAL_DOCUMENTS.find((d) => d.slug === slug);
      expect(doc, link).toBeDefined();
      const ids = doc!.markdown ? ruleIds : new Set(doc!.sections.map((s) => s.id));
      expect(ids.has(id!), link).toBe(true);
    }
  });
});
