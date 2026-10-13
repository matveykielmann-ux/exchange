import type { LegalDocument } from './types';

export const CONTACT_AND_NOTICES: LegalDocument = {
  slug: 'contact',
  title: 'Contact and Legal Notices',
  version: '1.0.0',
  effectiveDate: null,
  lastUpdated: '2026-10-13',
  summary:
    'How to contact {{brand}} for support, complaints, privacy requests and formal legal notices, and where our regulatory information will be published.',
  acceptance: null,
  sections: [
    {
      id: 'support',
      heading: 'Customer support',
      blocks: [
        {
          type: 'p',
          text: 'For help with your account or an order, use the support chat in the Service or email {{supportEmail}}. Please include your order reference where relevant. We will never ask for your password, one-time codes, seed phrase or private keys.',
        },
        {
          type: 'review',
          id: 'LR-29',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Support hours, support phone number (if any), dedicated complaints email address, and any response or resolution targets to be published, including any timeframes required by state law for complaint acknowledgement and resolution.]',
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
          text: 'Formal legal notices to {{brand}}, including notices of dispute under the Terms of Service, should be sent in writing. Until a postal address is published on this page, send them by email to {{supportEmail}} with "Legal notice" in the subject line. We send notices to you at the email address on your account.',
        },
        {
          type: 'review',
          id: 'LR-18',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Registered address and mailing address for legal notices and service of process.]',
        },
      ],
    },
    {
      id: 'regulatory-status',
      heading: 'Regulatory status',
      blocks: [
        {
          type: 'p',
          text: 'Information about the company that operates {{brand}}, and about its federal registrations and state licenses, will be published on this page once it has been confirmed. Where a registration or license is required to serve residents of a particular state, we will offer the Service in that state only once it is in place.',
        },
        {
          type: 'review',
          id: 'LR-01',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Registered legal name and state of formation of the operating entity, which must be named as the contracting party in the Terms, as the business responsible for personal information in the Privacy Policy, and under Regulatory status on the Contact page.]',
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
      heading: 'Trademarks',
      blocks: [
        {
          type: 'p',
          text: '{{brand}} and the {{brand}} logo are trademarks used by the company that operates the Service. Other names and marks belong to their respective owners, and their mention does not imply any affiliation or endorsement.',
        },
        {
          type: 'review',
          id: 'LR-12',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Trademark clearance and ownership of the "Arcvale" name and logo, and the entity that owns them.]',
        },
      ],
    },
  ],
};
