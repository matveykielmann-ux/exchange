import type { LegalDocument } from './types';

export const KYC_AML_NOTICE: LegalDocument = {
  slug: 'kyc-aml',
  title: 'Identity Verification and AML/KYC Notice',
  version: '1.0.0',
  effectiveDate: null,
  lastUpdated: '2026-10-13',
  summary:
    'To prevent fraud, money laundering and sanctions violations, {{brand}} verifies the identity of every customer and reviews transactions, and may ask you for more information at any time.',
  acceptance: null,
  sections: [
    {
      id: 'why-we-verify',
      heading: 'Why we verify your identity',
      blocks: [
        {
          type: 'p',
          text: 'Businesses that exchange digital assets for US dollars are expected to know who their customers are and to watch for financial crime under US anti-money-laundering (AML) and sanctions laws, including the Bank Secrecy Act. Verifying your identity also helps protect you from someone opening an account or selling assets in your name.',
        },
        {
          type: 'p',
          text: 'You must complete identity verification before you can place an order.',
        },
      ],
    },
    {
      id: 'what-we-may-ask-for',
      heading: 'What we may ask for',
      blocks: [
        {
          type: 'list',
          items: [
            'your full legal name, date of birth and residential address;',
            "a valid government-issued photo ID, such as a driver's license, state ID or passport;",
            'your Social Security number or Individual Taxpayer Identification Number (ITIN);',
            'a selfie or short video so that it can be compared with your ID photo;',
            'information and documents about the source of your funds or of the digital assets you are selling, such as exchange statements or wallet records; and',
            'information about the purpose of a transaction or your relationship to a sending wallet.',
          ],
        },
        {
          type: 'p',
          text: 'We may ask for more information than others, and at different times, depending on your verification level, the size and pattern of your orders, and our risk assessment. Large-transaction requests always receive additional review, which can include enhanced due diligence on the source of funds.',
        },
        {
          type: 'review',
          id: 'LR-27',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Verification tiers (to be set by the compliance officer), the documents and checks required at each tier, transaction limits per tier, and the triggers for enhanced due diligence, consistent with the written AML program.]',
        },
      ],
    },
    {
      id: 'verification-provider',
      heading: 'Who performs verification',
      blocks: [
        {
          type: 'p',
          text: 'Identity verification is performed by a third-party identity-verification provider on our behalf. You submit your ID and selfie directly to the provider through the Service. The provider checks the authenticity of your documents, compares your selfie with your ID, and checks your details against third-party data sources. It returns a result and a reference to us; we keep your verification status and the information we are required to keep.',
        },
        {
          type: 'review',
          id: 'LR-11',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Names of the contracted identity-verification, sanctions-screening and blockchain-analytics providers, if they must be identified to customers, and any provider terms the customer must accept.]',
        },
        {
          type: 'review',
          id: 'LR-19',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Whether the selfie and ID comparison creates biometric identifiers or information under state laws (for example Illinois BIPA, Texas CUBI, Washington) and, if so, the required written notice, consent, retention schedule and destruction policy, and whether the identity-verification provider or the operator is responsible.]',
        },
      ],
    },
    {
      id: 'screening-and-monitoring',
      heading: 'Screening and monitoring',
      blocks: [
        {
          type: 'p',
          text: 'We screen customers against US government sanctions lists and other restricted-party lists, and we screen blockchain addresses, including the addresses deposits come from and your refund address, using blockchain-analytics tools. We monitor orders for unusual activity, such as patterns that suggest structuring, scams or the movement of illicit funds.',
        },
      ],
    },
    {
      id: 'holds-and-decisions',
      heading: 'Holds, requests and decisions',
      blocks: [
        {
          type: 'p',
          text: 'An order may be held for compliance review. During a review we may request more information, and the order will not proceed until the review is complete. After review, we may approve the order, reject it and return your deposit to your refund address less network fees, or, where the law requires, block or report the funds.',
        },
        {
          type: 'p',
          text: 'We may be legally prohibited from explaining the reason for a review or decision. If you do not provide requested information within the time we specify, we may reject the order.',
        },
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
      ],
    },
    {
      id: 'records',
      heading: 'How long we keep verification records',
      blocks: [
        {
          type: 'p',
          text: 'We keep identity and transaction records for as long as required by law, for example under the Bank Secrecy Act recordkeeping rules, including after your account is closed. Our Privacy Policy explains how we use and protect this information.',
        },
        {
          type: 'review',
          id: 'LR-21',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Retention schedule for each category of personal information (account, identity verification, transaction, payout, device/security, support chat, notifications, legal acceptances), including confirmation of the Bank Secrecy Act recordkeeping period (generally five years) and any longer state requirements.]',
        },
      ],
    },
  ],
};
