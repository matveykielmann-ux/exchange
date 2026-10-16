import type { LegalDocument } from './types';

export const REFUND_POLICY: LegalDocument = {
  slug: 'refunds',
  title: 'Cancellation, Rejection and Refund Policy',
  version: '3.0.0',
  effectiveDate: '2026-03-01',
  lastUpdated: '2026-03-01',
  summary:
    'How to cancel before sending funds, how to request a return through support after sending, and how manual refunds are calculated. In effect from March 1, 2026.',
  acceptance: 'order',
  sections: [
    {
      id: 'about',
      heading: 'About this policy',
      blocks: [
        {
          type: 'p',
          text: 'This policy brings together the clauses of the {{brand}} Service Rules on cancellations, refusals and returns, and explains how they apply on this site. The complete Service Rules are published on the Service Rules page.',
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
      heading: 'After you have sent funds',
      blocks: [
        { type: 'rules', refs: ['4.11', '9.2'] },
        {
          type: 'p',
          text: 'On this site the Cancel button is shown only until you send funds. To request a return after you have sent funds, contact support through Telegram ({{supportTelegram}}) or in-app support messages with your order reference. There is no self-service automatic cancel for crypto you have already sent.',
        },
        { type: 'rules', refs: ['9.5'] },
      ],
    },
    {
      id: 'how-returns-work',
      heading: 'How returns are made',
      blocks: [
        { type: 'rules', refs: ['9.3', '9.4', '9.6', '9.9', '9.10'] },
        {
          type: 'p',
          text: 'When you place an order, you may give a refund address for the same asset and network. It is screened before use. Returns are recorded once; the system does not complete the same return twice.',
        },
      ],
    },
    {
      id: 'mistakes',
      heading: 'Wrong network, wrong details and accidental transfers',
      blocks: [{ type: 'rules', refs: ['9.7', '9.8', '4.19'] }],
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
      id: 'payouts',
      heading: 'Returned or failed payouts',
      blocks: [
        {
          type: 'p',
          text: 'Once a payout has been recorded as sent, it cannot be cancelled after the fact. If a payout is returned by your bank or card issuer, we will contact you through support to arrange another method. We pay the net amount in the accepted quote; we do not re-price the completed exchange.',
        },
      ],
    },
    {
      id: 'contact',
      heading: 'Questions or disputes',
      blocks: [
        {
          type: 'p',
          text: 'If you have a question about a cancellation, refusal or return, contact us through Telegram ({{supportTelegram}}) or in-app support messages and include your order reference. If you are not satisfied with our response, see the Complaints and Support Policy.',
        },
      ],
    },
  ],
};
