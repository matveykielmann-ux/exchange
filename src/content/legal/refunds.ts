import type { LegalDocument } from './types';

export const REFUND_POLICY: LegalDocument = {
  slug: 'refunds',
  title: 'Cancellation, Rejection and Refund Policy',
  version: '2.0.0',
  effectiveDate: null,
  lastUpdated: '2026-10-14',
  summary:
    'When an Exchange Request can be cancelled, when it may be refused, and how funds are returned, with the return fees and timeframes quoted word for word from the Service Rules.',
  acceptance: 'order',
  sections: [
    {
      id: 'about',
      heading: 'About this policy',
      blocks: [
        {
          type: 'p',
          text: 'This policy brings together the clauses of the {{brand}} Service Rules on cancellations, refusals and returns, quoted word for word, and explains how they apply to an order placed on this site. The complete Service Rules are published on the Service Rules page.',
        },
      ],
    },
    {
      id: 'before-you-send',
      heading: 'Before you send funds',
      blocks: [
        {
          type: 'p',
          text: 'A locked quote is valid for a limited time, currently 60 seconds. If you do not confirm in time, the quote expires and you can request a new one. After you confirm, you have a deposit window, currently 30 minutes. If you decide not to proceed, simply do not send a deposit: the order will expire when the window closes, and nothing is owed by either of us. You can also cancel the order from its status page before you send funds.',
        },
        { type: 'p', text: 'Do not send funds for an order that has expired. The Service Rules provide:' },
        { type: 'rules', refs: ['4.14'] },
      ],
    },
    {
      id: 'after-you-send',
      heading: 'Cancelling after you have sent funds',
      blocks: [
        { type: 'rules', refs: ['4.11', '9.2'] },
        {
          type: 'p',
          text: 'On this site the Cancel button is shown only until you send funds. To cancel an order after you have sent funds, contact support through the support chat or at {{supportEmail}} with your order reference.',
        },
        { type: 'rules', refs: ['9.5'] },
      ],
    },
    {
      id: 'not-completed',
      heading: 'When an exchange cannot be completed',
      blocks: [{ type: 'rules', refs: ['4.2', '4.12'] }],
    },
    {
      id: 'refusals',
      heading: 'When we may refuse or hold an exchange',
      blocks: [
        { type: 'rules', refs: ['9.1', '4.5', '4.8'] },
        {
          type: 'p',
          text: 'Holds, document requests and frozen funds after an AML check are governed by Section 8 of the Service Rules, quoted in the Identity Verification and AML/KYC Notice.',
        },
      ],
    },
    {
      id: 'delays',
      heading: 'If your payout is delayed',
      blocks: [{ type: 'rules', refs: ['4.13', '4.15'] }],
    },
    {
      id: 'how-returns-work',
      heading: 'How returns are made',
      blocks: [
        {
          type: 'p',
          text: 'When you place an order on this site, you give a refund address for the same asset and network as your deposit. It is screened before the order is accepted. The Service Rules provide:',
        },
        { type: 'rules', refs: ['9.3', '9.4', '9.6', '8.3'] },
      ],
    },
    {
      id: 'return-fees',
      heading: 'Return fees',
      blocks: [{ type: 'rules', refs: ['9.7', '9.8'] }],
    },
    {
      id: 'mistakes',
      heading: 'Wrong network, wrong details and accidental transfers',
      blocks: [{ type: 'rules', refs: ['9.9', '9.10', '4.19'] }],
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
          text: '[OWNER/COUNSEL INPUT REQUIRED: Treatment of funds or digital assets that cannot be paid out or returned (for example closed bank account, unreachable customer, invalid refund address), and the dormancy periods that apply, consistent with clause 8.2 of the Service Rules on frozen funds.]',
        },
      ],
    },
    {
      id: 'contact',
      heading: 'Questions or disputes',
      blocks: [
        {
          type: 'p',
          text: 'If you have a question about a cancellation, refusal or return, contact us through the support chat or at {{supportEmail}} and include your order reference. If you are not satisfied with our response, see the Complaints and Support Policy.',
        },
        {
          type: 'review',
          id: 'LR-36',
          text: '[NOT YET IMPLEMENTED: the return fees in clauses 9.2, 9.7 and 9.8 and the 72-hour and 14-day return periods are not applied by the system yet. Refunds are requested through support and reviewed only after completed identity verification.]',
        },
      ],
    },
  ],
};
