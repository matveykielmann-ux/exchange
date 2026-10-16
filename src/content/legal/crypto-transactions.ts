import type { LegalDocument } from './types';

export const CRYPTO_TRANSACTIONS_DISCLOSURE: LegalDocument = {
  slug: 'crypto-transactions',
  title: 'Cryptocurrency Transaction and Irreversibility Disclosure',
  version: '3.0.0',
  effectiveDate: '2026-03-01',
  lastUpdated: '2026-03-01',
  summary:
    'How a crypto sale or purchase works on this site, deposit windows, confirmations, manual verification, and why blockchain transfers cannot be reversed. In effect from March 1, 2026.',
  acceptance: 'order',
  sections: [
    {
      id: 'how-a-sale-works',
      heading: 'How a sale works',
      blocks: [
        {
          type: 'list',
          ordered: true,
          items: [
            'You request an itemized quote showing the reference price, the exchange fee and any bank or courier amounts, and the net US dollar amount.',
            'You have a limited time to accept the quote, currently 60 seconds. If it expires, you must refresh it and the price may change.',
            'You confirm the order. Deposit instructions (including a deposit address when you are selling crypto) are issued through the Service; addresses may be assigned by our operations team.',
            'You send exactly the quoted amount on the stated network within the deposit window, currently 30 minutes from confirmation.',
            'Staff and/or available external data (such as blockchain explorers) are used to verify the deposit. A TXID you enter is a tip, not proof by itself.',
            'After any required review, we start your payout. Completion is recorded when the payout has actually been sent (including when an operator records a manual payout).',
          ],
        },
      ],
    },
    {
      id: 'conforming-deposit',
      heading: 'What counts as a conforming deposit',
      blocks: [
        { type: 'p', text: 'A deposit is paid at the locked rate only if it meets all of these conditions:' },
        {
          type: 'list',
          items: [
            'Exact amount: the amount confirmed at the deposit address equals the quoted amount.',
            'Correct asset and network: the asset and network must match the order.',
            'Correct address: you must send to the deposit address issued for this order.',
            'On time: funds must be received within the deposit window for the locked rate to apply.',
            'One transaction: send the full amount in a single transaction when possible.',
          ],
        },
      ],
    },
    {
      id: 'confirmations',
      heading: 'When a deposit is received',
      blocks: [
        {
          type: 'p',
          text: 'Required network confirmations for assets offered on this Service are set in Section 5 of the Service Rules and match the product configuration:',
        },
        { type: 'rules', refs: ['5'] },
        { type: 'rules', refs: ['4.22'] },
        {
          type: 'p',
          text: 'Confirmation times depend on the network and are outside our control. Manual verification by staff may be used when processing your order.',
        },
      ],
    },
    {
      id: 'non-conforming-deposits',
      heading: 'Late, incorrect or wrong-network deposits',
      blocks: [
        {
          type: 'p',
          text: 'A deposit that arrives after the deposit window, for a different amount, or on a different network is not paid at the locked rate automatically and is held for review:',
        },
        { type: 'rules', refs: ['4.14', '4.12', '9.7', '9.8'] },
      ],
    },
    {
      id: 'refund-address',
      heading: 'Your refund address',
      blocks: [
        {
          type: 'p',
          text: 'When you place an order, you may give a refund address for the same asset and network. Check it carefully: a return sent to the address you provided cannot be reversed if the address was wrong.',
        },
      ],
    },
    {
      id: 'irreversibility',
      heading: 'Transactions are irreversible',
      blocks: [
        {
          type: 'p',
          text: 'Blockchain transactions are final. Once broadcast, neither you nor {{brand}} can cancel, reverse or change them. Always confirm the asset, network, address and amount before you send.',
        },
        { type: 'rules', refs: ['4.19'] },
      ],
    },
    {
      id: 'network-fees',
      heading: 'Network fees',
      blocks: [
        {
          type: 'p',
          text: 'Sending a digital asset requires a network fee paid to the blockchain through your wallet, not to {{brand}}. Return handling under the current model is described in the Cancellation, Rejection and Refund Policy.',
        },
      ],
    },
  ],
};
