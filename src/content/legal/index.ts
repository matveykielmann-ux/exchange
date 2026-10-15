import type { LegalDocument } from './types';
import { SERVICE_RULES } from './terms';
import { PRIVACY_POLICY } from './privacy';
import { ELECTRONIC_COMMUNICATIONS_CONSENT } from './e-sign';
import { COOKIE_POLICY } from './cookies';
import { RISK_DISCLOSURE } from './risk';
import { CRYPTO_TRANSACTIONS_DISCLOSURE } from './crypto-transactions';
import { FEE_DISCLOSURE } from './fees';
import { REFUND_POLICY } from './refunds';
import { KYC_AML_NOTICE } from './kyc-aml';
import { SANCTIONS_NOTICE } from './sanctions';
import { COMPLAINTS_POLICY } from './complaints';
import { CASH_DELIVERY_TERMS } from './cash-delivery';
import { ACCESSIBILITY_STATEMENT } from './accessibility';
import { CONTACT_AND_NOTICES } from './contact';

export type { LegalBlock, LegalDocument, LegalSection } from './types';

/** Every legal document, in display order. */
export const LEGAL_DOCUMENTS: LegalDocument[] = [
  SERVICE_RULES,
  PRIVACY_POLICY,
  ELECTRONIC_COMMUNICATIONS_CONSENT,
  COOKIE_POLICY,
  RISK_DISCLOSURE,
  CRYPTO_TRANSACTIONS_DISCLOSURE,
  FEE_DISCLOSURE,
  REFUND_POLICY,
  KYC_AML_NOTICE,
  SANCTIONS_NOTICE,
  COMPLAINTS_POLICY,
  CASH_DELIVERY_TERMS,
  ACCESSIBILITY_STATEMENT,
  CONTACT_AND_NOTICES,
];

/** Returns the document with the given slug, or undefined if there is none. */
export function getLegalDocument(slug: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find((doc) => doc.slug === slug);
}
