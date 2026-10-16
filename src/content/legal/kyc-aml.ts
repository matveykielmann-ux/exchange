import type { LegalDocument } from './types';

export const KYC_AML_NOTICE: LegalDocument = {
  slug: 'kyc-aml',
  title: 'Identity Verification and AML/KYC Notice',
  version: '3.0.0',
  effectiveDate: '2026-03-01',
  lastUpdated: '2026-03-01',
  summary:
    'How {{brand}} verifies identity and checks transactions under the KYC and AML/CTF provisions of the Service Rules, which are quoted here word for word. In effect from March 1, 2026.',
  acceptance: null,
  sections: [
    {
      id: 'about',
      heading: 'About this notice',
      blocks: [
        {
          type: 'p',
          text: 'This notice quotes the identity-verification (KYC) and AML/CTF provisions of the {{brand}} Service Rules and explains how they apply on this site. A separate owner-supplied detailed AML/CTF policy has not been published; until it is, this notice and Section 8 of the Service Rules are the published KYC/AML terms. The /en/kyc-aml-policy path opens this notice.',
        },
      ],
    },
    {
      id: 'verification',
      heading: 'Identity verification',
      blocks: [
        { type: 'rules', refs: ['8.1', '4.4', '4.5'] },
        {
          type: 'p',
          text: 'You may view quotes, register and submit an Exchange Request before identity verification is completed. The Company may suspend payout, refund or other money movement until verification or other checks required by applicable law, risk policy or a contracted integration are completed. When verification is used, you submit your ID and selfie through the Service (or a contracted provider’s flow). We keep your verification status and the information we are required to keep. Provider names are published only when a contracted provider is confirmed for customer disclosure.',
        },
      ],
    },
    {
      id: 'monitoring',
      heading: 'Transaction monitoring and AML checks',
      blocks: [
        { type: 'rules', refs: ['8.2'] },
        {
          type: 'p',
          text: 'On this site, the addresses deposits come from and the refund address you give us are screened, and an order may be held for review at any stage. During a review the order does not proceed until the review is complete. If funds are returned, Section 9 of the Service Rules applies.',
        },
      ],
    },
    {
      id: 'completion',
      heading: 'When an exchange can be completed',
      blocks: [{ type: 'rules', refs: ['8.4'] }],
    },
    {
      id: 'returns',
      heading: 'Returns after an AML check',
      blocks: [{ type: 'rules', refs: ['8.3'] }],
    },
    {
      id: 'restricted',
      heading: 'Restricted countries and regions',
      blocks: [
        { type: 'rules', refs: ['8.5'] },
        { type: 'p', text: 'The Sanctions and Restricted-Jurisdiction Notice explains how this applies on this site.' },
      ],
    },
    {
      id: 'your-obligations',
      heading: 'Your obligations',
      blocks: [
        {
          type: 'list',
          items: [
            'Give us true, accurate and complete information, and tell us promptly if it changes.',
            'Use the Service only for yourself, with assets you own and from wallets you control.',
            'Do not split orders, use multiple accounts or provide misleading information to avoid limits or reviews.',
          ],
        },
        {
          type: 'p',
          text: 'Providing false information or documents may lead to the closure of your account and may be reported to authorities.',
        },
        { type: 'rules', refs: ['4.1', '4.3'] },
      ],
    },
    {
      id: 'records',
      heading: 'How long we keep verification records',
      blocks: [
        {
          type: 'p',
          text: 'We keep identity and transaction records for as long as applicable law requires, including after your account is closed. Our Privacy Policy explains how we use and protect this information.',
        },
      ],
    },
  ],
};
