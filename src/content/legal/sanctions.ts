import type { LegalDocument } from './types';

export const SANCTIONS_NOTICE: LegalDocument = {
  slug: 'sanctions',
  title: 'Sanctions and Restricted-Jurisdiction Notice',
  version: '2.1.0',
  effectiveDate: null,
  lastUpdated: '2026-10-14',
  summary:
    'The countries and regions the Service Rules exclude, the ban on tools that conceal identity or location, and what happens to funds affected by sanctions.',
  acceptance: null,
  sections: [
    {
      id: 'restricted-jurisdictions',
      heading: 'Restricted countries and regions',
      blocks: [{ type: 'rules', refs: ['8.5'] }],
    },
    {
      id: 'where-available',
      heading: 'Where this site currently operates',
      blocks: [
        {
          type: 'p',
          text: 'The Service is not limited to residents of the United States. Sign-up asks for your country of residence and a confirmation that you are not resident in, and are not acting from, a country or region listed in clause 8.5; accounts from those places are refused. Bank and card payouts are made to US bank accounts and US debit cards, and cash collection and delivery by courier are available only at US addresses in a courier’s service area.',
        },
      ],
    },
    {
      id: 'location',
      heading: 'Concealing identity or location',
      blocks: [
        {
          type: 'p',
          text: 'You may not use a VPN, proxy or any other tool to disguise your location or to access the Service from a place where it is not available. Section 11 of the Service Rules provides:',
        },
        { type: 'rules', refs: ['11'] },
      ],
    },
    {
      id: 'screening',
      heading: 'Sanctions screening',
      blocks: [
        {
          type: 'p',
          text: 'We screen customers, deposits and blockchain addresses, including the addresses that send deposits to us and the refund addresses you give us. We will not accept deposits from, or send returns to, addresses that are identified on a sanctions list or that we determine are associated with sanctioned persons or other illicit activity.',
        },
        {
          type: 'review',
          id: 'LR-44',
          text: '[OWNER/COUNSEL INPUT REQUIRED: The Service Rules do not name specific sanctions regimes or lists. Confirm which sanctions lists the operator screens against, and whether this page should name them, given that the Service is not limited to US residents.]',
        },
      ],
    },
    {
      id: 'sanctions-concern',
      heading: 'What happens if there is a sanctions concern',
      blocks: [
        {
          type: 'p',
          text: 'If a customer, deposit or address raises a sanctions concern, we will hold the order for review, and clause 8.2 of the Service Rules applies. Under that clause, funds frozen due to sanctions-related restrictions may remain blocked until such restrictions are lifted. We may also close the account.',
        },
      ],
    },
    {
      id: 'representations',
      heading: 'Your representations',
      blocks: [
        {
          type: 'p',
          text: 'Each time you use the Service, you confirm that you are not a sanctioned person, are not in a restricted jurisdiction, and are not selling assets that belong to or are controlled by a sanctioned person. Tell us immediately if any of this changes.',
        },
      ],
    },
  ],
};
