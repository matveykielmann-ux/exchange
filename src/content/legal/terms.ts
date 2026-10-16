/// <reference types="vite/client" />
import type { LegalDocument } from './types';
// Owner Service Rules — updated for the 2026-03-01 owner package. Replace the
// Markdown file and bump version + SHA when the owner supplies a new source.
import SERVICE_RULES_MARKDOWN from './source/CRYPTOBIT_EXCHANGE_SERVICE_RULES.md?raw';

/** SHA-256 of the supplied file. A test fails if the text in the repository drifts from it. */
export const SERVICE_RULES_SHA256 = 'a515a4f29cd764af120961d13d34b7cf4ce994cd59672ced9b3830f9b6ef4542';

export const SERVICE_RULES: LegalDocument = {
  slug: 'terms',
  title: 'Service Rules',
  version: '3.0.0',
  effectiveDate: '2026-03-01',
  lastUpdated: '2026-03-01',
  summary:
    'The public offer of the {{brand}} service, published in full. Submitting an Exchange Request is acceptance of this offer (Section 3). In effect from March 1, 2026.',
  acceptance: 'order',
  markdown: SERVICE_RULES_MARKDOWN,
  reviewNotes: [],
  sections: [],
};
