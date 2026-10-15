/**
 * Brand constants. "CryptoBit Exchange" is the brand named in the owner's
 * Service Rules (src/content/legal/source/). Trademark clearance is an open
 * item in LEGAL_REVIEW.md (LR-12). Legal-entity facts live in src/config/legal.ts.
 */
export const BRAND = {
  name: 'CryptoBit Exchange',
  supportEmail: 'support@example.com', // RFC 2606 reserved domain until the owner provides a real inbox (LEGAL_REVIEW.md, LR-39).
} as const;

/** Official support contacts supplied by the owner (2026-10-14). Clause 4.21 of the Service Rules: use only these. */
export const SUPPORT = {
  telegramUrl: 'https://t.me/cryptocurrency_1exchange',
  telegramHandle: '@cryptocurrency_1exchange',
  /** Service working hours (Service Rules, clause 4.20 and Section 5). */
  hours: { open: '07:00', close: '16:00', timeZone: 'America/New_York', label: '07:00–16:00 New York time (America/New_York)' },
} as const;
