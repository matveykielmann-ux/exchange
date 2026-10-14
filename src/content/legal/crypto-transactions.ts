import type { LegalDocument } from './types';

export const CRYPTO_TRANSACTIONS_DISCLOSURE: LegalDocument = {
  slug: 'crypto-transactions',
  title: 'Cryptocurrency Transaction and Irreversibility Disclosure',
  version: '1.0.0',
  effectiveDate: null,
  lastUpdated: '2026-10-13',
  summary:
    'Your deposit is paid at the locked rate only if you send exactly the quoted amount, on the stated network, to the address we give you, within the deposit window, and blockchain transactions cannot be reversed.',
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
        { type: 'p', text: 'To be paid at the locked rate, your deposit must meet all of these conditions:' },
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
          text: 'A deposit is received only when our systems have observed it on the blockchain and it has reached the number of network confirmations we require for that network. Until then its status is pending. A transaction hash, a screenshot from your wallet, or a message that you have sent funds does not prove that a deposit has been received, and we cannot act on it.',
        },
        {
          type: 'p',
          text: 'Confirmation times depend on the network and how busy it is, and are outside our control.',
        },
        {
          type: 'review',
          id: 'LR-07',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Required number of network confirmations for each supported asset and network, whether these are published in the Service or in this document, and whether the deposit window is measured to the first observation of the transaction or to the required confirmations.]',
        },
      ],
    },
    {
      id: 'non-conforming-deposits',
      heading: 'Late, incorrect or wrong-network deposits',
      blocks: [
        {
          type: 'p',
          text: 'If your deposit arrives after the deposit window, is for a different amount than quoted, or is sent on a different supported network, it will not be paid at the locked rate. We will review it and, if it is eligible to be returned, send it back in the same asset to the refund address on your order, less the network fees for the return transaction.',
        },
        {
          type: 'review',
          id: 'LR-08',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Policy for non-conforming deposits (late, wrong amount, wrong supported network): whether a new quote at the current rate may be offered as an alternative to return; any handling fee beyond network fees; the minimum amount worth returning when network fees exceed the deposit; and the target review timeframe.]',
        },
        {
          type: 'p',
          text: 'If you send an asset or use a network that we do not support for the deposit address, we may be technically unable to access or return it, and it may be permanently lost.',
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
          text: 'Blockchain transactions are final. Once broadcast, neither you nor {{brand}} can cancel, reverse or change them. We cannot recover assets sent to the wrong address, sent on an unsupported network, or sent to a scammer. Always confirm the asset, network, address and amount before you send.',
        },
      ],
    },
    {
      id: 'network-fees',
      heading: 'Network fees',
      blocks: [
        {
          type: 'p',
          text: 'Sending a digital asset requires a network fee (sometimes called a gas or miner fee), which you pay to the blockchain network through your wallet, not to {{brand}}. Network fees for a return of your deposit are deducted from the amount returned.',
        },
      ],
    },
    {
      id: 'screening-and-holds',
      heading: 'Screening and holds',
      blocks: [
        {
          type: 'p',
          text: 'We screen deposits and the addresses they come from. A deposit may be held for review if, for example, it is linked to sanctioned parties, stolen funds, scams or other illicit activity. We may ask you for information about the source of the funds. If we cannot complete a review, we may decline the order and return the deposit, or, where the law requires, block or report it.',
        },
      ],
    },
  ],
};
