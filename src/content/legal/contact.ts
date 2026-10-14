import type { LegalDocument } from './types';

export const CONTACT_AND_NOTICES: LegalDocument = {
  slug: 'contact',
  title: 'Contact and Legal Notices',
  version: '2.1.0',
  effectiveDate: null,
  lastUpdated: '2026-10-14',
  summary: 'Who operates {{brand}}, which contacts are official, and how to reach us for support, complaints, privacy requests and claims.',
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
        {
          type: 'review',
          id: 'LR-18',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Registered office address and mailing address of the Panama company for legal notices and service of process. They are not stated in the Service Rules.]',
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
            'Email: {{supportEmail}}',
            'Service working hours (clause 4.20 and Section 5): {{supportHours}}',
          ],
        },
        {
          type: 'p',
          text: 'Contact us only through the contacts listed on this page. Nobody from {{brand}} will ask you to send crypto or cash on their behalf, or for your password, one-time codes, seed phrase or private keys.',
        },
        {
          type: 'review',
          id: 'LR-39',
          text: '[OWNER INPUT REQUIRED: The Telegram support account and the working hours were confirmed on 2026-10-14. The remaining official contacts clause 4.21 refers to (the official email address, social networks and other messengers) have not been supplied; the email shown is a placeholder.]',
        },
      ],
    },
    {
      id: 'support',
      heading: 'Customer support',
      blocks: [
        {
          type: 'p',
          text: 'For help with your account or an order, message us on Telegram ({{supportTelegram}}), use the support messages in the Service, or email {{supportEmail}}. We answer during the Service working hours, {{supportHours}}. Please include your order reference where relevant. We will never ask for your password, one-time codes, seed phrase or private keys.',
        },
        {
          type: 'review',
          id: 'LR-29',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Support phone number (if any), dedicated complaints email address, and any response or resolution targets to be published, including any timeframes required by state law for complaint acknowledgement and resolution.]',
        },
      ],
    },
    {
      id: 'complaints-and-privacy',
      heading: 'Complaints and privacy requests',
      blocks: [
        {
          type: 'p',
          text: 'To make a complaint, follow the steps in our Complaints and Support Policy. To exercise privacy rights, see our Privacy Policy. Both can be started by emailing {{supportEmail}}.',
        },
        {
          type: 'review',
          id: 'LR-24',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Dedicated privacy contact (email and, if a state law requires it, a toll-free number or web form) for privacy requests, and the postal address for privacy correspondence.]',
        },
      ],
    },
    {
      id: 'legal-notices',
      heading: 'Formal legal notices',
      blocks: [
        {
          type: 'p',
          text: 'Formal legal notices to {{brand}}, including claims under Section 16 of the Service Rules, should be sent in writing. Until a postal address is published on this page, send them by email to {{supportEmail}} with "Legal notice" in the subject line. We send notices to you at the email address on your account.',
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
        {
          type: 'review',
          id: 'LR-32',
          text: '[OWNER/COUNSEL INPUT REQUIRED: FinCEN money services business (MSB) registration status and registration number, if registered. Note that FinCEN registration is not a license and must not be described as one.]',
        },
        {
          type: 'review',
          id: 'LR-04',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Money transmitter and virtual-currency licensing status for each state served, including New York (BitLicense / money transmitter license) and California (DFAL). The Service must not be offered in a state until its licensing position is confirmed.]',
        },
        {
          type: 'review',
          id: 'LR-33',
          text: '[OWNER/COUNSEL INPUT REQUIRED: NMLS unique identifier of the operating entity, if any, and a link to its NMLS Consumer Access record.]',
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
        {
          type: 'review',
          id: 'LR-12',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Trademark clearance and ownership of the "CryptoBit Exchange" name and logo, and the entity that owns them.]',
        },
      ],
    },
  ],
};
