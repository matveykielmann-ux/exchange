/**
 * A deliberately small Markdown reader for legal documents supplied as
 * Markdown (for example the Service Rules). It covers exactly the syntax those
 * documents use: ATX headings, paragraphs with hard line breaks (a trailing
 * backslash), "- " bullet lists with continuation lines, pipe tables with an
 * alignment row, **bold** and [links](url). Everything else is kept as text,
 * so nothing in a source document is ever dropped silently.
 */

export type MdInline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: MdInline[] }
  | { type: 'link'; href: string; children: MdInline[] }
  | { type: 'br' };

export type MdAlign = 'left' | 'center' | 'right' | null;

export type MdBlock =
  | { type: 'heading'; level: number; id: string; text: string; children: MdInline[] }
  /** `id` is set for a numbered clause ("4.11. …" → "clause-4-11") so other pages can link to it. */
  | { type: 'paragraph'; id?: string; children: MdInline[] }
  | { type: 'list'; items: MdInline[][] }
  | { type: 'table'; align: MdAlign[]; head: MdInline[][]; rows: MdInline[][][] };

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^[-*+]\s+(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const ALIGN_ROW = /^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)/;
/** A numbered clause such as "4.11. The User may…". */
const CLAUSE = /^(\d+\.\d+)\.\s/;

export const clauseId = (ref: string) => `clause-${ref.replace(/\./g, '-')}`;

/** Parses inline syntax: **bold**, [text](href) and hard line breaks ("\" + newline). */
export function parseInline(source: string): MdInline[] {
  const out: MdInline[] = [];
  let text = '';
  const flush = () => {
    if (text) out.push({ type: 'text', text });
    text = '';
  };
  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    if (rest.startsWith('\\\n')) {
      flush();
      out.push({ type: 'br' });
      i += 2;
      continue;
    }
    if (rest.startsWith('**')) {
      const close = source.indexOf('**', i + 2);
      if (close > i + 2) {
        flush();
        out.push({ type: 'strong', children: parseInline(source.slice(i + 2, close)) });
        i = close + 2;
        continue;
      }
    }
    if (rest.startsWith('[')) {
      const m = LINK.exec(rest);
      if (m) {
        flush();
        out.push({ type: 'link', href: m[2]!, children: parseInline(m[1]!) });
        i += m[0].length;
        continue;
      }
    }
    text += source[i];
    i += 1;
  }
  flush();
  return out;
}

/** Plain text of inline content, as a reader sees it (links show their text). */
export function inlineText(nodes: MdInline[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'text':
          return n.text;
        case 'br':
          return '\n';
        case 'strong':
        case 'link':
          return inlineText(n.children);
      }
    })
    .join('');
}

/** Stable fragment id for a heading: "4. Procedure for…" → "4-procedure-for…". */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

/** A trailing backslash only means a line break between lines of the same block; at the very end of a block it is dropped. */
const trimBlockEnd = (s: string) => s.replace(/\\\s*$/, '');

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

function alignOf(cell: string): MdAlign {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return null;
}

/** Parses a Markdown document into blocks. Line endings may be LF or CRLF. */
export function parseMarkdown(source: string): MdBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MdBlock[] = [];
  const ids = new Map<string, number>();
  const uniqueId = (text: string) => {
    const base = slugify(text);
    const n = ids.get(base) ?? 0;
    ids.set(base, n + 1);
    return n ? `${base}-${n + 1}` : base;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      const children = parseInline(heading[2]!);
      const text = inlineText(children);
      blocks.push({ type: 'heading', level: heading[1]!.length, id: uniqueId(text), text, children });
      i += 1;
      continue;
    }

    if (TABLE_ROW.test(line) && ALIGN_ROW.test(lines[i + 1] ?? '')) {
      const head = splitRow(line).map(parseInline);
      const align = splitRow(lines[i + 1]!).map(alignOf);
      const rows: MdInline[][][] = [];
      i += 2;
      while (i < lines.length && TABLE_ROW.test(lines[i]!)) {
        rows.push(splitRow(lines[i]!).map(parseInline));
        i += 1;
      }
      blocks.push({ type: 'table', align, head, rows });
      continue;
    }

    if (BULLET.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const current = lines[i]!;
        const bullet = BULLET.exec(current);
        if (bullet) items.push(bullet[1]!);
        // An indented line continues the current item (after a hard break or as a soft wrap).
        else if (/^\s+\S/.test(current) && items.length) items[items.length - 1] += `\n${current.trim()}`;
        else break;
        i += 1;
      }
      blocks.push({ type: 'list', items: items.map((t) => parseInline(trimBlockEnd(t))) });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length) {
      const current = lines[i]!;
      if (!current.trim() || HEADING.test(current) || BULLET.test(current) || TABLE_ROW.test(current)) break;
      para.push(current.trim());
      i += 1;
    }
    const clause = CLAUSE.exec(para[0]!);
    blocks.push({
      type: 'paragraph',
      ...(clause ? { id: clauseId(clause[1]!) } : {}),
      children: parseInline(trimBlockEnd(para.join('\n'))),
    });
  }
  return blocks;
}

export interface MdExcerpt {
  ref: string;
  /** Fragment id on the full document to link to. */
  anchor: string;
  /** "clause 4.11" or "Section 6. Fees". */
  label: string;
  blocks: MdBlock[];
}

/**
 * Cuts one clause ("4.11") or one whole section ("6") out of a parsed document,
 * word for word. A clause runs until the next numbered clause or heading, so
 * lists and paragraphs that belong to it come with it. Throws if `ref` does
 * not exist, so a page can never quote a clause the document does not have.
 */
export function excerpt(blocks: MdBlock[], ref: string): MdExcerpt {
  const isClause = (b: MdBlock | undefined) => b?.type === 'paragraph' && CLAUSE.test(inlineText(b.children));
  if (/^\d+$/.test(ref)) {
    const start = blocks.findIndex((b) => b.type === 'heading' && b.text.startsWith(`${ref}. `));
    if (start < 0) throw new Error(`No Section ${ref} in this document`);
    const heading = blocks[start] as Extract<MdBlock, { type: 'heading' }>;
    let end = start + 1;
    while (end < blocks.length && !(blocks[end]!.type === 'heading' && (blocks[end] as { level: number }).level <= heading.level)) end += 1;
    return { ref, anchor: heading.id, label: `Section ${heading.text}`, blocks: blocks.slice(start + 1, end) };
  }
  const start = blocks.findIndex((b) => b.type === 'paragraph' && b.id === clauseId(ref));
  if (start < 0) throw new Error(`No clause ${ref} in this document`);
  let end = start + 1;
  while (end < blocks.length && blocks[end]!.type !== 'heading' && !isClause(blocks[end])) end += 1;
  return { ref, anchor: clauseId(ref), label: `clause ${ref}`, blocks: blocks.slice(start, end) };
}

/**
 * The heading levels a document uses, in ascending order. Renderers map the
 * first to <h2>, the next to <h3> and so on, so "#" followed by "###" still
 * produces an outline without gaps.
 */
export function headingRanks(blocks: MdBlock[]): number[] {
  return [...new Set(blocks.flatMap((b) => (b.type === 'heading' ? [b.level] : [])))].sort((a, b) => a - b);
}

/** Plain text of a parsed document, one block per line, used to prove a rendering is complete. */
export function blocksText(blocks: MdBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'heading':
          return b.text;
        case 'paragraph':
          return inlineText(b.children);
        case 'list':
          return b.items.map(inlineText).join('\n');
        case 'table':
          return [b.head, ...b.rows].map((r) => r.map(inlineText).join(' ')).join('\n');
      }
    })
    .join('\n');
}
