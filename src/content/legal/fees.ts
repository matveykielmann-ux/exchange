import type { LegalDocument } from './types';

export const FEE_DISCLOSURE: LegalDocument = {
  slug: 'fees',
  title: 'Fee and Exchange-Rate Disclosure',
  version: '3.0.0',
  effectiveDate: '2026-03-01',
  lastUpdated: '2026-03-01',
  summary:
    'How {{brand}} calculates the exchange fee (2% buy / 3% sell), how bank wire estimates and courier costs appear on your quote, and how the locked rate works. In effect from March 1, 2026.',
  acceptance: 'order',
  sections: [
    {
      id: 'commission',
      heading: 'The commission in the Service Rules',
      blocks: [{ type: 'rules', refs: ['6'] }],
    },
    {
      id: 'rates',
      heading: 'How rates are determined',
      blocks: [{ type: 'rules', refs: ['5'] }],
    },
    {
      id: 'how-pricing-works',
      heading: 'What your quote shows',
      blocks: [
        { type: 'p', text: 'Every quote shows these lines, in US dollars, before you confirm:' },
        {
          type: 'list',
          items: [
            'Reference price: the market price per unit of the asset from the connected reference source (CoinGecko), and the resulting US dollar value of the amount you are exchanging (the reference value).',
            'Exchange fee: {{brand}}’s commission — 3% when you sell crypto for USD, 2% when you buy crypto with USD — calculated on the reference value and rounded to the nearest cent.',
            'Bank processing fee (wire only): an estimated bank charge (typically $30). It is not {{brand}} commission and is not kept by {{brand}} as its fee.',
            'Courier fee (cash by courier only): calculated individually for your order and shown before you continue.',
            'Net amount: what you receive (sell) or the USD amount converted after fees (buy).',
          ],
        },
        {
          type: 'p',
          text: 'Your quote uses the market reference price with no spread. The final quote is not the same as the raw reference price: it includes the fees and conditions of the Exchange Request.',
        },
        { type: 'rules', refs: ['4.24'] },
      ],
    },
    {
      id: 'payout-fees',
      heading: 'Fee schedule',
      blocks: [
        {
          type: 'list',
          items: [
            'Sell crypto for USD (ACH, wire, or debit card): 3% {{brand}} exchange fee.',
            'Buy crypto with USD (wire, card, or cash collection): 2% {{brand}} exchange fee.',
            'Domestic bank wire: estimated $30 bank processing fee in addition to the exchange fee (bank’s charge, not {{brand}} revenue).',
            'Cash by courier: delivery or collection cost calculated individually for each order (set by an operator and accepted by you before the exchange continues).',
          ],
        },
        {
          type: 'p',
          text: 'There is no published minimum or maximum order amount. Amounts on your quote before you confirm are the amounts that apply to that order if you send a conforming payment in the deposit window.',
        },
      ],
    },
    {
      id: 'quote-governs',
      heading: 'The quote you accept governs',
      blocks: [
        {
          type: 'p',
          text: 'A quote is valid for a limited time, currently 60 seconds, and must be refreshed if it expires. When you confirm an order, the rate, fees and net amounts in the accepted quote apply for the deposit window, currently 30 minutes. If funds arrive after the window, or the amount differs, the Service Rules provide:',
        },
        { type: 'rules', refs: ['4.12', '4.14'] },
        {
          type: 'p',
          text: 'We may change published fee schedules by updating this page and the Service Rules. A change does not affect an order you have already confirmed.',
        },
      ],
    },
    {
      id: 'return-fees',
      heading: 'Return fees',
      blocks: [{ type: 'rules', refs: ['9.2', '9.3'] }],
    },
    {
      id: 'fees-not-charged-by-us',
      heading: 'Fees charged by others',
      blocks: [
        {
          type: 'list',
          items: [
            'Network fees: you pay a network fee to the blockchain when you send a deposit. It is not paid to {{brand}} and is not included in your quote.',
            'Bank and card issuer fees: your bank or card issuer may charge their own fees. Those are separate from the estimated bank processing fee shown on a wire quote.',
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
          text: 'After your order completes, a receipt showing the itemized amounts, deposit reference and payout reference (when available) is shown in your transaction history.',
        },
      ],
    },
  ],
};
