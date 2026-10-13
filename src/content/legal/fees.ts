import type { LegalDocument } from './types';

export const FEE_DISCLOSURE: LegalDocument = {
  slug: 'fees',
  title: 'Fee and Exchange-Rate Disclosure',
  version: '1.0.0',
  effectiveDate: null,
  lastUpdated: '2026-10-13',
  summary:
    'You pay {{brand}} a spread on the reference price and a payout fee that depends on how you are paid, and every amount is itemized in your quote before you confirm.',
  acceptance: 'order',
  sections: [
    {
      id: 'how-pricing-works',
      heading: 'How your price is calculated',
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
          ],
        },
        {
          type: 'p',
          text: 'Current amounts are shown on the Fees page and in each quote. Each payout method also has its own minimum and maximum order amounts, shown in the Service.',
        },
      ],
    },
    {
      id: 'quote-governs',
      heading: 'The quote you accept governs',
      blocks: [
        {
          type: 'p',
          text: 'A locked quote is valid for a limited time, currently 60 seconds, and must be refreshed if it expires. When you confirm an order, the rate, spread, payout fee and net payout in the accepted quote apply to that order, provided that you send a conforming deposit within the deposit window, currently 30 minutes. A deposit that is late, for a different amount or on a different network is not paid at the locked rate; see the Cancellation, Rejection and Refund Policy.',
        },
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
          text: 'Orders of about $25,000 or more are handled by our large-transaction desk. Pricing for these orders is set individually and is confirmed with you in writing, itemized in the same way, before you send any funds. Any indicative pricing shown on the request form is not an offer.',
        },
      ],
    },
    {
      id: 'fees-not-charged-by-us',
      heading: 'Fees we do not charge',
      blocks: [
        {
          type: 'list',
          items: [
            'Network fees: you pay a network fee to the blockchain network when you send your deposit. This fee is not paid to {{brand}} and is not included in your quote. If a deposit is returned, network fees for the return are deducted from the returned amount.',
            'Bank and card fees: your bank or card issuer may charge fees to receive a wire or other payment. These are set by them and are not included in your quote.',
          ],
        },
        {
          type: 'p',
          text: 'Apart from the spread and payout fee shown in your quote, {{brand}} does not charge fees for using the Service.',
        },
        {
          type: 'review',
          id: 'LR-08',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Policy for non-conforming deposits (late, wrong amount, wrong supported network): whether a new quote at the current rate may be offered as an alternative to return; any handling fee beyond network fees; the minimum amount worth returning when network fees exceed the deposit; and the target review timeframe.]',
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
          text: '[OWNER/COUNSEL INPUT REQUIRED: Any state-mandated consumer disclosures that must appear in these Terms, the Risk Disclosure, receipts or complaint notices (for example 23 NYCRR Part 200 disclosures in New York, California DFAL disclosures, and state regulator contact details for complaints).]',
        },
      ],
    },
  ],
};
