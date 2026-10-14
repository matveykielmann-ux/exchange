import type { LegalDocument } from './types';

export const REFUND_POLICY: LegalDocument = {
  slug: 'refunds',
  title: 'Cancellation, Rejection and Refund Policy',
  version: '1.0.0',
  effectiveDate: null,
  lastUpdated: '2026-10-13',
  summary:
    'This policy explains when an order can be cancelled, when we may reject it, and how eligible deposits are returned to your refund address.',
  acceptance: 'order',
  sections: [
    {
      id: 'before-you-send',
      heading: 'Before you send your deposit',
      blocks: [
        {
          type: 'p',
          text: 'A locked quote is valid for a limited time, currently 60 seconds. If you do not confirm in time, the quote expires and you can request a new one. After you confirm, you have a deposit window, currently 30 minutes. If you decide not to proceed, simply do not send a deposit: the order will expire when the window closes, and nothing is owed by either of us.',
        },
        {
          type: 'p',
          text: 'Do not send a deposit for an order that has expired. A deposit sent after the window closes is not paid at the locked rate.',
        },
      ],
    },
    {
      id: 'after-you-send',
      heading: 'After you send your deposit',
      blocks: [
        {
          type: 'p',
          text: 'Blockchain transactions cannot be reversed, so once you have sent a deposit you cannot cancel it. Once our systems have confirmed a conforming deposit, the order proceeds at the locked rate and you cannot cancel it. If you believe you sent a deposit in error, contact support immediately; we will review the situation but cannot promise a return.',
        },
        {
          type: 'review',
          id: 'LR-10',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Whether Regulation E (Electronic Fund Transfer Act) or the Remittance Transfer Rule applies to any part of the payout, and if so the required error-resolution, cancellation and disclosure rights to add to these Terms, the Refund Policy and the Complaints Policy.]',
        },
      ],
    },
    {
      id: 'non-conforming-deposits',
      heading: 'Late, incorrect or wrong-network deposits',
      blocks: [
        {
          type: 'p',
          text: 'A deposit that arrives after the deposit window, is for a different amount from the quoted amount, or is sent on a different supported network is not paid at the locked rate. After review, an eligible deposit is returned in the same asset to the refund address on your order, less the network fees for the return.',
        },
        {
          type: 'p',
          text: 'A deposit sent on a network we do not support for that address may be permanently unrecoverable, and we may be unable to return it.',
        },
        {
          type: 'review',
          id: 'LR-08',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Policy for non-conforming deposits (late, wrong amount, wrong supported network): whether a new quote at the current rate may be offered as an alternative to return; any handling fee beyond network fees; the minimum amount worth returning when network fees exceed the deposit; and the target review timeframe.]',
        },
      ],
    },
    {
      id: 'rejections',
      heading: 'When we may reject or hold an order',
      blocks: [
        {
          type: 'p',
          text: 'We may hold an order for review, ask you for more information, or reject it at any stage before payout, including if:',
        },
        {
          type: 'list',
          items: [
            'we cannot verify your identity, or you do not give us information we request;',
            'the deposit, its sending address or your refund address is linked to sanctions, fraud, scams, stolen funds or other illicit activity;',
            "we believe you may be the victim of a scam or acting on someone else's instructions;",
            'the order would breach our Terms of Service, our limits or the law; or',
            'the quote was affected by a clear pricing error or market disruption, as described in the Terms of Service.',
          ],
        },
        {
          type: 'p',
          text: 'If we reject an order after receiving your deposit, we will return the deposit as described below, unless the law requires us to hold, block or report the funds. We may not be able to tell you the reason for a decision.',
        },
      ],
    },
    {
      id: 'how-returns-work',
      heading: 'How returns work',
      blocks: [
        {
          type: 'list',
          items: [
            'Returns are made in the same digital asset you sent, on the same network, to the refund address on your order. We do not return deposits in US dollars or to another address unless the law requires otherwise.',
            'Network fees for the return transaction are deducted from the amount returned.',
            'Returns are made only after review. Review time varies and is not guaranteed.',
            'A return sent to the refund address you provided is final and cannot be reversed.',
            'We do not compensate for changes in the market price of the asset between your deposit and its return.',
          ],
        },
      ],
    },
    {
      id: 'payouts',
      heading: 'Returned or failed payouts',
      blocks: [
        {
          type: 'p',
          text: 'Once a payout has been confirmed as sent, it cannot be cancelled. If a payout is returned by your bank or card issuer, for example because the account is closed or the details are incorrect, we will contact you to arrange another payout method. We pay the net amount in the accepted quote; we do not re-price the order.',
        },
        {
          type: 'review',
          id: 'LR-17',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Treatment of funds or digital assets that cannot be paid out or returned (for example closed bank account, unreachable customer, invalid refund address), including escheatment under state unclaimed-property laws and the dormancy periods that apply.]',
        },
      ],
    },
    {
      id: 'contact',
      heading: 'Questions or disputes',
      blocks: [
        {
          type: 'p',
          text: 'If you have a question about a cancellation, rejection or return, contact us through the support chat or at {{supportEmail}} and include your order reference. If you are not satisfied with our response, see the Complaints and Support Policy.',
        },
      ],
    },
  ],
};
