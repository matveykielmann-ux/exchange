import type { LegalDocument } from './types';

export const PRIVACY_POLICY: LegalDocument = {
  slug: 'privacy',
  title: 'Privacy Policy',
  version: '3.0.0',
  effectiveDate: '2026-03-01',
  lastUpdated: '2026-03-01',
  summary:
    'This policy explains what personal information {{brand}} collects, why we collect it, who we share it with, how long we keep it and the choices you have. In effect from March 1, 2026.',
  acceptance: 'signup',
  sections: [
    {
      id: 'who-we-are',
      heading: 'Who we are and what this policy covers',
      blocks: [
        {
          type: 'p',
          text: 'This Privacy Policy applies to personal information that CryptoBit Exchange, a company incorporated under the laws of the Republic of Panama, registration number No. 155778934, operating under the brand {{brand}} ("we", "us" or "our"), collects through the {{brand}} website, applications, support channels and related services (the "Service"). It applies to visitors, applicants and customers.',
        },
        { type: 'p', text: 'Section 15 of the Service Rules provides:' },
        { type: 'rules', refs: ['15'] },
        {
          type: 'p',
          text: 'Because we provide a financial service, much of the information we collect is required by law, for example to verify your identity, screen for sanctions and keep transaction records. If you do not provide information we are required to collect, we cannot open or maintain your account.',
        },
      ],
    },
    {
      id: 'information-we-collect',
      heading: 'Information we collect',
      blocks: [
        { type: 'p', text: 'Depending on how you use the Service, we collect the following categories of personal information:' },
        {
          type: 'list',
          items: [
            'Account information: your email address, full name, password and, if you choose to give it, your phone number. We store your password only as a salted cryptographic hash, never in readable form.',
            'Residence information: your US state of residence and, during verification, your address.',
            'Identity-verification information: name, date of birth, residential address, government-issued ID, Social Security number or ITIN, a selfie or other image for comparison with your ID, and, where needed, information about the source of your funds. Identity documents and images are collected and processed by our identity-verification provider; we keep your verification status, the provider reference and the information we need to meet our legal obligations.',
            'Payout information: bank account and routing numbers for ACH and wire payouts, and debit-card numbers for manual card payouts, which we encrypt at rest and display to you only as the last four digits. Authorized operators may view a full card number in the CRM for a payout they are processing; each such view is recorded in the audit log without storing the number in the log entry. We never collect or store card security codes (CVV/CVC), PINs or one-time codes. Card payments you make to us are completed on an external processor’s payment page, not on forms that collect full card authorization data on this site.',
            'Digital asset information: the refund wallet address you give us, deposit addresses issued to you, deposit transaction hashes, and the blockchain data associated with those transactions.',
            'Transaction information: quotes, orders, amounts, rates, fees, statuses, review outcomes and payout references.',
            'Device and security information: IP address, approximate location derived from your IP address, browser and device type (user agent), session identifiers, sign-in times and security events.',
            'Communications: messages you send through the support chat or by email, and records of the notifications we send you.',
            'Legal acceptance records: which legal documents and versions you accepted, and when.',
          ],
        },
      ],
    },
    {
      id: 'sources',
      heading: 'Where we get information',
      blocks: [
        {
          type: 'list',
          items: [
            'From you, when you sign up, verify your identity, request quotes, place orders, add payout details or contact support.',
            'Automatically, from your browser or device when you use the Service.',
            'From service providers, such as our identity-verification provider (verification results), sanctions-screening and blockchain-analytics providers (screening results and risk information about blockchain addresses), and payout providers (payout confirmations and returns).',
            'From public blockchains, which record the transactions you send to us.',
            'From government authorities, where they provide information to us lawfully.',
          ],
        },
      ],
    },
    {
      id: 'how-we-use-information',
      heading: 'How we use information',
      blocks: [
        { type: 'p', text: 'We use personal information solely to fulfil our obligations under the Service Rules, which means to:' },
        {
          type: 'list',
          items: [
            'create and manage your account and sign you in securely;',
            'verify your identity, determine your eligibility and screen you and blockchain addresses against sanctions and other lists;',
            'provide quotes, process orders, confirm deposits, send payouts and return deposits where required;',
            'detect, investigate and prevent fraud, scams, money laundering, sanctions violations and security incidents;',
            'meet our legal and regulatory obligations, including recordkeeping, reporting and responding to lawful requests;',
            'communicate with you about your account, orders, legal documents and support requests; and',
            'keep the Service working and secure.',
          ],
        },
        {
          type: 'p',
          text: 'We do not use your personal information for advertising, and we do not use analytics, advertising or third-party tracking cookies.',
        },
      ],
    },
    {
      id: 'sharing',
      heading: 'How we share information',
      blocks: [
        {
          type: 'p',
          text: 'We do not sell your personal information. We disclose it to third parties only as required by law or as necessary to fulfil our obligations, as described below.',
        },
        {
          type: 'list',
          items: [
            'Service providers who act on our behalf under contract, including providers of identity verification, sanctions screening, blockchain analytics, payout processing (ACH, wire and debit card), email delivery, customer support tools, and cloud hosting and security. They may use the information only to provide services to us, except where the law requires them to keep it.',
            'Banks and payment networks, to the extent needed to send your payout.',
            'Government authorities, regulators and law enforcement, when the law requires it, including reports we are required to file, or in response to valid legal process. Clause 4.3 of the Service Rules also allows transaction information to be provided to law enforcement agencies, payment system administrations, and victims of unlawful acts proven by court decisions.',
          ],
        },
      ],
    },
    {
      id: 'retention',
      heading: 'How long we keep information',
      blocks: [
        {
          type: 'p',
          text: 'We keep personal information for as long as your account is open and afterwards for as long as applicable law requires for identity and transaction records, and for as long as reasonably needed to resolve disputes, enforce our agreements and protect against fraud. When we no longer need information, we delete or de-identify it.',
        },
        {
          type: 'p',
          text: 'Because of these obligations, we may be unable to delete identity-verification, transaction and related records when you close your account or ask us to delete your information.',
        },
      ],
    },
    {
      id: 'security',
      heading: 'How we protect information',
      blocks: [
        {
          type: 'p',
          text: "We use administrative, technical and physical safeguards designed to protect personal information. These include storing passwords only as salted hashes, encrypting bank account details at rest, displaying payout details only in masked form, encrypting debit-card numbers used for manual payouts at rest, masking them in the customer interface, auditing operator reveals of full card numbers in the CRM, never collecting CVV/CVC, PINs or one-time codes, using secure session cookies, and limiting access to people who need it for their work.",
        },
        {
          type: 'p',
          text: 'No system is completely secure. Please protect your password and contact us through Telegram ({{supportTelegram}}) or in-app support messages if you believe your account has been compromised. If a security incident affects your personal information, we will notify you as required by law.',
        },
      ],
    },
    {
      id: 'storage-location',
      heading: 'Where information is stored',
      blocks: [
        {
          type: 'p',
          text: 'The Service is not limited to residents of the United States, and is not offered in the countries and regions listed in clause 8.5 of the Service Rules. Some of our service providers may process information in other countries, subject to contractual protections.',
        },
      ],
    },
    {
      id: 'your-choices-and-rights',
      heading: 'Your choices and rights',
      blocks: [
        {
          type: 'list',
          items: [
            'Access and correction: you can review and update much of your account information in the Service, and you can ask us for a copy of the personal information we hold about you or to correct it.',
            'Deletion: you can ask us to delete your personal information. We will delete what we are not required or permitted by law to keep.',
            'Communications: you can opt out of any non-essential emails. We will still send messages about your account, orders and legal documents.',
            'Cookies and storage: you can control cookies and browser storage in your browser settings; see the Cookie Policy.',
          ],
        },
        {
          type: 'p',
          text: 'To make a request, contact us through Telegram ({{supportTelegram}}) or in-app support messages. We will need to verify your identity before acting on a request, and you may use an authorized agent where the law allows. We will not discriminate against you for exercising your privacy rights.',
        },
        {
          type: 'p',
          text: 'Depending on where you live, you may have additional rights under the data-protection laws that apply to you.',
        },
      ],
    },
    {
      id: 'children',
      heading: 'Children',
      blocks: [
        {
          type: 'p',
          text: 'The Service is not directed to children and is available only to adults aged 18 or older. We do not knowingly collect personal information from children under 13. If you believe a child has given us personal information, contact us and we will delete it as permitted by law.',
        },
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to this policy',
      blocks: [
        {
          type: 'p',
          text: 'We may update this policy. The version and effective date are shown at the top of this page. If we make a material change, we will notify you by email or in the Service before it takes effect.',
        },
      ],
    },
    {
      id: 'contact',
      heading: 'Contact us',
      blocks: [
        {
          type: 'p',
          text: 'For privacy questions or requests, contact us through Telegram ({{supportTelegram}}) or in-app support messages or through the support chat in the Service.',
        },
      ],
    },
  ],
};
