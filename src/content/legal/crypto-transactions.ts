import type { LegalDocument } from './types';

export const CRYPTO_TRANSACTIONS_DISCLOSURE: LegalDocument = {
  slug: 'crypto-transactions',
  title: 'Cryptocurrency Transaction and Irreversibility Disclosure',
  version: '2.0.0',
  effectiveDate: null,
  lastUpdated: '2026-10-14',
  summary:
    'How a sale works on this site, what the Service Rules require when you send crypto, what happens if a deposit is late, different or on the wrong network, and why blockchain transactions cannot be reversed.',
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
            'You request an itemized quote showing the reference price, our spread, the payout fee and the net US dollar amount you will receive.',
            'You lock the quote. A locked quote is valid for a limited time, currently 60 seconds. If it expires, you must refresh it and the price may change.',
            'You confirm the order. We show you a deposit address, the exact amount to send and the network to use.',
            'You send exactly that amount on that network within the deposit window, currently 30 minutes from confirmation.',
            'Our systems observe your deposit on the blockchain and wait for the required number of network confirmations.',
            'After any required review, we start your payout. We tell you it has been sent once our payout provider confirms it.',
          ],
        },
      ],
    },
    {
      id: 'conforming-deposit',
      heading: 'What counts as a conforming deposit',
      blocks: [
        { type: 'p', text: 'On this site, a deposit is paid at the locked rate only if it meets all of these conditions:' },
        {
          type: 'list',
          items: [
            'Exact amount: the amount received at the deposit address must equal the quoted amount. Many wallets and exchanges deduct their withdrawal fee from the amount you enter, so check that the amount that will arrive is the quoted amount.',
            'Correct asset and network: the asset and network must match the order. For example, USDT sent on Tron (TRC-20) is not the same as USDT sent on Ethereum (ERC-20), and USDC on Base is not the same as USDC on Ethereum or Solana.',
            'Correct address: you must send to the deposit address issued for this order. Each address is for a single order; do not reuse it.',
            'On time: your transaction must be observed by our systems within the deposit window.',
            'One transaction: send the full amount in a single transaction.',
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
          text: 'On this site, a deposit is treated as received when our systems have observed it on the blockchain and it has reached the number of network confirmations required for that network, shown when you choose the network. Until then its status is pending. The required confirmations are set by Section 5 of the Service Rules:',
        },
        { type: 'rules', refs: ['5'] },
        { type: 'p', text: 'The Service Rules also require proof of sending:' },
        { type: 'rules', refs: ['4.22'] },
        {
          type: 'review',
          id: 'LR-35',
          text: '[CONFLICT WITH SITE BEHAVIOR: the order page accepts only an optional transaction hash; there is no way to upload the screenshot clause 4.22 requires, and the order moves forward only when deposit monitoring observes the transaction.]',
        },
        {
          type: 'p',
          text: 'Confirmation times depend on the network and how busy it is, and are outside our control.',
        },
        {
          type: 'review',
          id: 'LR-38',
          text: '[OWNER INPUT REQUIRED: Section 5 sets no confirmation count for USDC on Solana or Base, which this site accepts, and lists BEP-20, which this site does not accept. The site uses 32 (Solana) and 12 (Base) confirmations until the owner sets them.]',
        },
      ],
    },
    {
      id: 'non-conforming-deposits',
      heading: 'Late, incorrect or wrong-network deposits',
      blocks: [
        {
          type: 'p',
          text: 'On this site, a deposit that arrives after the deposit window, is for a different amount than quoted, or is sent on a different network is not paid at the locked rate and is held for review. The Service Rules provide:',
        },
        { type: 'rules', refs: ['4.14', '4.12', '9.9', '9.10'] },
        {
          type: 'review',
          id: 'LR-37',
          text: '[CONFLICT WITH SITE BEHAVIOR: clause 4.12 provides for recalculation to the amount actually received; the system does not recalculate and holds any differing deposit for review and return.]',
        },
      ],
    },
    {
      id: 'refund-address',
      heading: 'Your refund address',
      blocks: [
        {
          type: 'p',
          text: 'When you place an order, you give us a refund address for the same asset and network. It must be an address you own or control. We screen refund addresses and may refuse an address associated with sanctions, fraud or other illicit activity. Check it carefully: a return sent to the refund address you provided cannot be reversed, even if the address was wrong.',
        },
      ],
    },
    {
      id: 'irreversibility',
      heading: 'Transactions are irreversible',
      blocks: [
        {
          type: 'p',
          text: 'Blockchain transactions are final. Once broadcast, neither you nor {{brand}} can cancel, reverse or change them. We cannot recover assets sent to the wrong address or sent to a scammer. Always confirm the asset, network, address and amount before you send.',
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
          text: 'Sending a digital asset requires a network fee (sometimes called a gas or miner fee), which you pay to the blockchain network through your wallet, not to {{brand}}. Fees for returning a deposit are set by clauses 9.7 and 9.8 of the Service Rules, quoted in the Cancellation, Rejection and Refund Policy.',
        },
      ],
    },
    {
      id: 'screening-and-holds',
      heading: 'Screening and holds',
      blocks: [
        {
          type: 'p',
          text: 'We screen deposits and the addresses they come from. A deposit may be held for review if, for example, it is linked to sanctioned parties, stolen funds, scams or other illicit activity. We may ask you for information about the source of the funds. Reviews, document requests and frozen funds are governed by clause 8.2 of the Service Rules, quoted in the Identity Verification and AML/KYC Notice.',
        },
      ],
    },
  ],
};
