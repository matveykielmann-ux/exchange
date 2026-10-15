/**
 * Business and legal facts used by the legal pages. Every field that is `null`
 * (or an empty list) is UNVERIFIED: the owner or counsel has not supplied it.
 * Pages omit unverified facts rather than inventing them, and LEGAL_REVIEW.md
 * tracks each one. Fill these in only from documents the owner has provided.
 */
export interface StateLicense {
  state: string;
  licenseType: string;
  number: string;
}

export const LEGAL_ENTITY = {
  brandName: 'CryptoBit Exchange',
  /** Registered legal name of the operating company (Service Rules, preamble). */
  legalName: 'CryptoBit Exchange' as string | null,
  /** Jurisdiction of incorporation (Service Rules, preamble). */
  jurisdiction: 'Republic of Panama' as string | null,
  registrationNumber: 'No. 155778934' as string | null,
  registeredAddress: null as string | null,
  mailingAddress: null as string | null,
  /** FinCEN MSB registration number, if registered. */
  fincenMsbRegistration: null as string | null,
  nmlsId: null as string | null,
  stateLicenses: [] as StateLicense[],
  supportEmail: 'support@example.com', // RFC 2606 reserved domain until the owner supplies a real inbox.
  complaintsEmail: null as string | null,
  privacyEmail: null as string | null,
  supportPhone: null as string | null,
  /** Owner decision 2026-10-14 (clause 4.20). */
  supportHours: '07:00–16:00 New York time (America/New_York)' as string | null,
  /** Official Telegram support (clause 4.21), owner decision 2026-10-14. */
  supportTelegram: 'https://t.me/cryptocurrency_1exchange' as string | null,
  /** Law that governs the Service Rules (Section 16). */
  governingLaw: 'the laws of the Republic of Panama' as string | null,
  /** Dispute resolution (Section 16): negotiations, then the competent court of the Republic of Panama after 60 calendar days. */
  disputeForum: 'the competent court of the Republic of Panama' as string | null,
  /** Owner decision 2026-10-14: not limited to US residents; only the territories in clause 8.5 are refused. */
  servedStates: null as string[] | null,
} as const;
