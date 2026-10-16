import type { LegalDocument } from './types';

export const SANCTIONS_NOTICE: LegalDocument = {
  slug: 'sanctions',
  title: 'Sanctions and Restricted-Jurisdiction Notice',
  version: '3.0.0',
  effectiveDate: '2026-03-01',
  lastUpdated: '2026-03-01',
  summary:
    'The countries and regions the Service Rules exclude, the ban on tools that conceal identity or location, and what happens to funds affected by sanctions. In effect from March 1, 2026.',
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
          text: 'The United States is the primary market. Sign-up asks for a US state of residence and a confirmation that you are not resident in, and are not acting from, a country or region listed in clause 8.5. Listing every US state in the interface is not a claim that the Service is licensed in every state. Availability for customers outside the United States is handled through support. Bank and card payouts are made to US bank accounts and US debit cards, and cash collection and delivery by courier are available only at US addresses in a courier’s service area.',
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
