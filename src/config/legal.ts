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
  brandName: 'Arcvale',
  /** Registered legal name of the operating company. */
  legalName: null as string | null,
  stateOfFormation: null as string | null,
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
  supportHours: null as string | null,
  /** State whose law governs the Terms. */
  governingLawState: null as string | null,
  /** Dispute-resolution forum or arbitration administrator, if any. */
  disputeForum: null as string | null,
  /** US states and territories where the service is offered. Null = not yet determined. */
  servedStates: null as string[] | null,
} as const;
