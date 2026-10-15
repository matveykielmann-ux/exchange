/**
 * Structured legal content. Each document is versioned; the server records
 * which version a customer accepted (see server/legal). Text may use the
 * tokens {{brand}} and {{supportEmail}}, which are replaced at render time.
 */
export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  /**
   * An unresolved fact. Rendered as a highlighted review callout only in
   * sandbox mode; omitted from production pages. `id` matches an entry in
   * LEGAL_REVIEW.md (e.g. "LR-07").
   */
  | { type: 'review'; id: string; text: string }
  /**
   * Clauses ("4.11") or whole sections ("6") of the Service Rules, quoted word
   * for word from the supplied document at render time, so a page can never
   * drift from the Rules it quotes.
   */
  | { type: 'rules'; refs: string[] };

export interface LegalSection {
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  slug: string;
  title: string;
  /** Semantic version of the text. Bump on any substantive change. */
  version: string;
  /** ISO date the version takes effect, or null until counsel sets it. */
  effectiveDate: string | null;
  /** ISO date of the last edit. */
  lastUpdated: string;
  /** One-sentence plain-language summary shown at the top of the page. */
  summary: string;
  /** Whether customers must accept this document (sign-up or order confirmation). */
  acceptance: 'signup' | 'order' | null;
  sections: LegalSection[];
  /**
   * The full text of a document the owner supplied as Markdown. When set, the
   * page renders this text verbatim (see ./markdown.ts) instead of `sections`.
   */
  markdown?: string;
  /**
   * Reviewer notes about a supplied document, such as conflicts between its
   * text and the Service's actual behavior. Shown in sandbox mode only, never
   * inside the document text. `id` matches an entry in LEGAL_REVIEW.md.
   */
  reviewNotes?: { id: string; text: string }[];
}
