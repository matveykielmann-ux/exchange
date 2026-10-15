import type { LegalDocument } from './types';

export const KYC_AML_NOTICE: LegalDocument = {
  slug: 'kyc-aml',
  title: 'Identity Verification and AML/KYC Notice',
  version: '2.0.0',
  effectiveDate: null,
  lastUpdated: '2026-10-14',
  summary:
    'How {{brand}} verifies identity and checks transactions under the KYC and AML/CTF provisions of the Service Rules, which are quoted here word for word.',
  acceptance: null,
  sections: [
    {
      id: 'about',
      heading: 'About this notice',
      blocks: [
        {
          type: 'p',
          text: 'This notice quotes the identity-verification (KYC) and AML/CTF provisions of the {{brand}} Service Rules and explains how they apply to an order placed on this site. The Service Rules link to a detailed AML/CTF policy at /en/kyc-aml-policy; that link currently opens this notice.',
        },
        {
          type: 'review',
          id: 'LR-40',
          text: '[OWNER INPUT REQUIRED: The detailed AML/CTF Policy that Section 8 of the Service Rules refers to has not been supplied. It must not be written from assumptions; publish it here or at /en/kyc-aml-policy once the owner provides it.]',
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
          text: 'On this site, you must complete identity verification before you can confirm an order. Identity verification is performed by a third-party identity-verification provider on our behalf. You submit your ID and selfie directly to the provider through the Service. The provider checks the authenticity of your documents, compares your selfie with your ID, and checks your details against third-party data sources. It returns a result and a reference to us; we keep your verification status and the information we are required to keep.',
        },
        {
          type: 'review',
          id: 'LR-11',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Names of the contracted identity-verification, sanctions-screening and blockchain-analytics providers, if they must be identified to customers, and any provider terms the customer must accept.]',
        },
        {
          type: 'review',
          id: 'LR-19',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Whether the selfie and ID comparison creates biometric data under the laws that apply to customers of the Service and, if so, the required notice, consent, retention schedule and destruction policy, and whether the identity-verification provider or the operator is responsible.]',
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
          text: 'On this site, the addresses deposits come from and the refund address you give us are screened, and an order may be held for review at any stage. During a review the order does not proceed until the review is complete. If funds are returned, Section 9 of the Service Rules applies, including the return fees in clauses 9.7 and 9.8.',
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
        {
          type: 'review',
          id: 'LR-21',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Retention schedule for each category of personal information (account, identity verification, transaction, payout, device/security, support chat, notifications, legal acceptances) under the law that applies to the operator, a company incorporated in the Republic of Panama.]',
        },
      ],
    },
  ],
};
