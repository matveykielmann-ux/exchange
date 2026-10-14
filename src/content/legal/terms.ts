/// <reference types="vite/client" />
import type { LegalDocument } from './types';
// The owner's official Service Rules, kept byte-for-byte as supplied. Never edit this file by hand:
// replace it with the owner's new version and bump `version` below (see LEGAL_REVIEW.md).
import SERVICE_RULES_MARKDOWN from './source/CRYPTOBIT_EXCHANGE_SERVICE_RULES.md?raw';

/** SHA-256 of the supplied file. A test fails if the text in the repository drifts from it. */
export const SERVICE_RULES_SHA256 = 'e07c55512792ec39b7543ec6992c5174da7f5a744b5c71600b4cc718ca38447e';

export const SERVICE_RULES: LegalDocument = {
  slug: 'terms',
  title: 'Service Rules',
  version: '2.0.0',
  effectiveDate: null,
  lastUpdated: '2026-03-27',
  summary:
    'The public offer of the {{brand}} service, published in full. Submitting an Exchange Request is acceptance of this offer (Section 3).',
  acceptance: 'order',
  markdown: SERVICE_RULES_MARKDOWN,
  reviewNotes: [
    {
      id: 'LR-34',
      text: 'Section 5 fixes the rate when the required confirmations arrive, during working hours, after proof of sending within 30 minutes. This site instead locks a quote for 60 seconds and holds that rate for a deposit that arrives within a 30-minute window.',
    },
    {
      id: 'LR-35',
      text: 'Clause 4.22 and Section 5 require the User to provide proof of sending (screenshot with time, wallet address, amount and TXID). This site accepts only an optional transaction hash and counts a deposit only when its own monitoring observes it.',
    },
    {
      id: 'LR-36',
      text: 'Return costs in clauses 9.2 (up to 5%), 9.7 (40 TRX, 0.0045 ETH, 0.0025 BNB) and 9.8 (100 USDT), and the 72-hour and 14-day return periods, are not implemented: the server returns the full observed deposit and tracks no return deadline.',
    },
    {
      id: 'LR-37',
      text: 'Clause 4.12 (recalculation to the amount actually received, termination only above a 10% difference) is not implemented: any deposit that differs from the quoted amount is held for review and returned.',
    },
    {
      id: 'LR-38',
      text: 'Networks differ from the Section 5 table: the Rules list USDT and USDC on TRC-20, ERC-20 and BEP-20; this site accepts USDT on ERC-20 and TRC-20 and USDC on ERC-20, Solana and Base, and no BEP-20. The Rules set no confirmation count for Solana or Base.',
    },
    {
      id: 'LR-39',
      text: '"Service working hours" (clause 4.20 and Section 5) and the official contacts, including the Telegram username (clause 4.21), are not published anywhere on this site.',
    },
    {
      id: 'LR-40',
      text: 'The AML/CTF Policy (/en/kyc-aml-policy) and Privacy Policy (/en/privacy-policy) these Rules link to have not been supplied. The links open the existing Identity Verification and AML/KYC Notice and Privacy Policy pages.',
    },
    {
      id: 'LR-41',
      text: 'Sign-up asks for a US state of residence and payouts go to US accounts or US addresses only, while the Rules restrict only the territories listed in clause 8.5.',
    },
    {
      id: 'LR-42',
      text: 'Clause 4.11 lets the User cancel after transferring funds; on this site the Cancel button is available only before funds are sent, so later cancellations go through support.',
    },
    {
      id: 'LR-43',
      text: 'The supplied text is reproduced exactly, including its typos ("reasongs" in 4.21, "Serice" in 4.23, "confiramtion" in 8.3). Correct them in the owner’s source document, not here.',
    },
  ],
  sections: [],
};
