import type { LegalDocument } from './types';

export const CONTACT_AND_NOTICES: LegalDocument = {
  slug: 'contact',
  title: 'Contact and Legal Notices',
  version: '3.0.0',
  effectiveDate: '2026-03-01',
  lastUpdated: '2026-03-01',
  summary: 'Who operates {{brand}}, which contacts are official, and how to reach us for support, complaints, privacy requests and claims. In effect from March 1, 2026.',
  acceptance: null,
  sections: [
    {
      id: 'company',
      heading: 'The company',
      blocks: [
        {
          type: 'p',
          text: 'The Service is provided by CryptoBit Exchange, a company incorporated under the laws of the Republic of Panama, registration number No. 155778934, operating under the brand {{brand}}, as stated in the Service Rules.',
        },
      ],
    },
    {
      id: 'official-contacts',
      heading: 'Official contacts',
      blocks: [
        { type: 'rules', refs: ['4.21'] },
        {
          type: 'list',
          items: [
            'Telegram support: {{supportTelegram}}',
            'In-app support messages, available after you sign in',
            'Service working hours (clause 4.20 and Section 5): {{supportHours}}',
          ],
        },
        {
          type: 'p',
          text: 'Contact us only through the contacts listed on this page. Nobody from {{brand}} will ask you to send crypto or cash on their behalf, or for your password, one-time codes, seed phrase or private keys.',
        },
      ],
    },
    {
      id: 'support',
      heading: 'Customer support',
      blocks: [
        {
          type: 'p',
          text: 'For help with your account or an order, message us on Telegram ({{supportTelegram}}) or use the support messages in the Service. We answer during the Service working hours, {{supportHours}}. Please include your order reference where relevant. We will never ask for your password, one-time codes, seed phrase or private keys.',
        },
      ],
    },
    {
      id: 'complaints-and-privacy',
      heading: 'Complaints and privacy requests',
      blocks: [
        {
          type: 'p',
          text: 'To make a complaint, follow the steps in our Complaints and Support Policy. To exercise privacy rights, see our Privacy Policy. Both can be started through Telegram ({{supportTelegram}}) or in-app support messages.',
        },
      ],
    },
    {
      id: 'legal-notices',
      heading: 'Formal legal notices',
      blocks: [
        {
          type: 'p',
          text: 'Formal legal notices to {{brand}}, including claims under Section 16 of the Service Rules, should be sent in writing. Until a postal address is published on this page, send them by email through Telegram ({{supportTelegram}}) or in-app support messages with "Legal notice" in the subject line. We send notices to you at the email address on your account.',
        },
      ],
    },
    {
      id: 'regulatory-status',
      heading: 'Registrations and licenses',
      blocks: [
        {
          type: 'p',
          text: 'The Service Rules do not state any registration or license of the company, and this site makes no claim to one.',
        },
      ],
    },
    {
      id: 'brand',
      heading: 'Intellectual property',
      blocks: [
        { type: 'rules', refs: ['14'] },
        {
          type: 'p',
          text: 'Other names and marks belong to their respective owners, and their mention does not imply any affiliation or endorsement.',
        },
      ],
    },
  ],
};
