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
            'Payout fee: our charge for the payout method you choose.',
            'Net payout: the amount in US dollars you will receive, after the spread and payout fee are deducted.',
          ],
        },
        {
          type: 'p',
          text: 'The difference between the reference price and the rate you receive is a cost to you and revenue to {{brand}}. Prices from other providers may be higher or lower than ours.',
        },
        {
          type: 'p',
          text: 'The spread, payout fee, minimum amount, quote validity and deposit window that apply to your order are shown when you create it. Clause 4.24 of the Service Rules provides:',
        },
        { type: 'rules', refs: ['4.24'] },
      ],
    },
    {
      id: 'spread',
      heading: 'Spread',
      blocks: [
        {
          type: 'p',
          text: 'The spread is tiered. It depends on the type of asset (for example, volatile assets such as BTC and ETH have a different spread from stablecoins such as USDT and USDC) and on the size of the order. Current spread tiers are shown on the Fees page and the spread that applies to your order is shown in each quote.',
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
            'ACH bank transfer: no payout fee.',
            'Domestic bank wire: a flat fee per payout.',
            'Debit card: a percentage of the payout amount, subject to a minimum and a maximum fee.',
            'Cash by courier: delivery cost calculated individually for each order (shown on the quote before you confirm).',
          ],
        },
        {
          type: 'p',
          text: 'Current amounts are shown on the Fees page and in each quote. Each payout method has its own minimum order amount, shown in the Service. There is no maximum.',
        },
      ],
    },
    {
      id: 'quote-governs',
      heading: 'The quote you accept governs',
      blocks: [
        {
          type: 'p',
          text: 'A locked quote is valid for a limited time, currently 60 seconds, and must be refreshed if it expires. When you confirm an order, the rate, spread, payout fee and net payout in the accepted quote apply to that order, provided that you send the quoted amount within the deposit window, currently 30 minutes. If the amount received differs, or funds arrive after the window, the Service Rules provide:',
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
