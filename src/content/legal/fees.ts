import type { LegalDocument } from './types';

export const FEE_DISCLOSURE: LegalDocument = {
  slug: 'fees',
  title: 'Fee and Exchange-Rate Disclosure',
  version: '2.0.0',
  effectiveDate: null,
  lastUpdated: '2026-10-14',
  summary:
    'How the {{brand}} commission is defined in the Service Rules, how it appears in your quote as a spread and a payout fee, and which return fees the Service Rules allow.',
  acceptance: 'order',
  sections: [
    {
      id: 'commission',
      heading: 'The commission in the Service Rules',
      blocks: [{ type: 'rules', refs: ['6', '2'] }],
    },
    {
      id: 'rates',
      heading: 'How rates are determined',
      blocks: [
        { type: 'rules', refs: ['5'] },
        {
          type: 'review',
          id: 'LR-34',
          text: '[CONFLICT WITH SITE BEHAVIOR: this site locks a quote for 60 seconds and holds its rate for a deposit that arrives within 30 minutes, rather than fixing the rate when the required confirmations arrive during working hours. See LEGAL_REVIEW.md.]',
        },
      ],
    },
    {
      id: 'how-pricing-works',
      heading: 'What your quote shows',
      blocks: [
        { type: 'p', text: 'Every quote shows these lines, in US dollars, before you confirm:' },
        {
          type: 'list',
          items: [
            'Reference price: the market price per unit of the asset that we use as the starting point for your quote, and the resulting US dollar value of the amount you are selling (the reference value).',
            'Spread: our charge, calculated as a percentage of the reference value and expressed in basis points (one basis point is 0.01%). It is deducted from the reference value.',
            'Exchange fee: our charge for the payout or pay-in method you choose (shown as a separate line).',
            'Net payout: the amount in US dollars you will receive after the exchange fee (and any bank processing fee) is deducted.',
          ],
        },
        {
          type: 'p',
          text: 'Your quote uses the market reference price with no spread. Prices from other providers may be higher or lower than ours.',
        },
        {
          type: 'p',
          text: 'The exchange fee, any bank processing fee, quote validity and deposit window that apply to your order are shown when you create it. Clause 4.24 of the Service Rules provides:',
        },
        { type: 'rules', refs: ['4.24'] },
      ],
    },
    {
      id: 'spread',
      heading: 'Exchange rate',
      blocks: [
        {
          type: 'p',
          text: 'There is no spread. The quote uses the market reference price at the moment of the quote. The fee for your method is shown as a separate dollar line on the Fees page and in each quote.',
        },
      ],
    },
    {
      id: 'payout-fees',
      heading: 'Payout fees',
      blocks: [
        {
          type: 'list',
          items: [
            'ACH bank transfer: a 3% exchange fee.',
            'Domestic bank wire: a published bank processing fee ($30) plus a 3% exchange fee.',
            'Debit card: a 3% exchange fee.',
            'Cash by courier: delivery cost calculated individually for each order (set by an operator and shown on the quote before you confirm).',
          ],
        },
        {
          type: 'p',
          text: 'Current amounts are shown on the Fees page and in each quote. There is no published minimum order amount and no maximum. Wire orders include a published bank processing fee plus the exchange fee, both shown before you confirm.',
        },
      ],
    },
    {
      id: 'quote-governs',
      heading: 'The quote you accept governs',
      blocks: [
        {
          type: 'p',
          text: 'A locked quote is valid for a limited time, currently 60 seconds, and must be refreshed if it expires. When you confirm an order, the rate, fees and net payout in the accepted quote apply to that order, provided that you send the quoted amount within the deposit window, currently 30 minutes. If the amount received differs, or funds arrive after the window, the Service Rules provide:',
        },
        { type: 'rules', refs: ['4.12', '4.14'] },
        {
          type: 'p',
          text: 'We may change our fee schedules and spread tiers at any time by updating the Fees page. A change does not affect an order you have already confirmed.',
        },
      ],
    },
    {
      id: 'large-transactions',
      heading: 'Large transactions',
      blocks: [
        {
          type: 'p',
          text: 'You may ask our large-transaction desk to price an order of $25,000 or more individually. Desk pricing is confirmed with you in writing, itemized in the same way, before you send any funds. Any indicative pricing shown on the request form is not an offer. Large orders placed online use the standard schedule.',
        },
      ],
    },
    {
      id: 'return-fees',
      heading: 'Return fees',
      blocks: [{ type: 'rules', refs: ['9.2', '9.7', '9.8'] }],
    },
    {
      id: 'additional-conditions',
      heading: 'Rates for additional conditions',
      blocks: [{ type: 'rules', refs: ['4.23'] }],
    },
    {
      id: 'fees-not-charged-by-us',
      heading: 'Fees charged by others',
      blocks: [
        {
          type: 'list',
          items: [
            'Network fees: you pay a network fee to the blockchain network when you send your deposit. This fee is not paid to {{brand}} and is not included in your quote.',
            'Bank and card fees: your bank or card issuer may charge fees to receive a wire or other payment. These are set by them and are not included in your quote.',
          ],
        },
      ],
    },
    {
      id: 'receipts',
      heading: 'Receipts',
      blocks: [
        {
          type: 'p',
          text: 'After your order completes, a receipt showing the same itemized amounts, the deposit transaction hash and the payout reference is available in your transaction history.',
        },
        {
          type: 'review',
          id: 'LR-05',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Any state-mandated consumer disclosures that must appear in the Service Rules, the Risk Disclosure, receipts or complaint notices (for example 23 NYCRR Part 200 disclosures in New York, California DFAL disclosures, and state regulator contact details for complaints).]',
        },
      ],
    },
  ],
};
