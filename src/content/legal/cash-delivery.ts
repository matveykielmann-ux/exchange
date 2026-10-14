import type { LegalDocument } from './types';

export const CASH_DELIVERY_TERMS: LegalDocument = {
  slug: 'cash-delivery',
  title: 'Cash Delivery Terms',
  version: '2.0.0',
  effectiveDate: null,
  lastUpdated: '2026-10-14',
  summary:
    'How a cash payout delivered by courier works: who can receive it, what we need from you, the identity check at the door and when a delivery can be refused or converted.',
  acceptance: null,
  sections: [
    {
      id: 'service',
      heading: 'The service',
      blocks: [
        {
          type: 'p',
          text: 'When you choose "Cash by courier" as your payout method, the US dollar proceeds of your order are handed to you in cash at the US address you give us, after your deposit is final and any review is complete. Delivery times are estimates and depend on your area and the carrier.',
        },
        {
          type: 'p',
          text: 'You must be signed in to a {{brand}} account and fully verified to place an order with cash delivery. Delivery is available only at addresses in areas the carrier serves; we check your ZIP code before you place the order.',
        },
        {
          type: 'p',
          text: 'If anyone offers you cash for digital assets in the name of {{brand}} outside an order in your account, they are not acting for us. Do not send them anything, and report it to us at {{supportEmail}}.',
        },
      ],
    },
    {
      id: 'details',
      heading: 'What you give us',
      blocks: [
        {
          type: 'list',
          items: [
            'The delivery address (street, city, state and ZIP code) and a phone number the courier can call.',
            'A preferred delivery date and time window. We try to meet it, but it is not guaranteed.',
            'Any instructions for the courier, such as a gate code. Do not include passwords or account details.',
          ],
        },
        {
          type: 'p',
          text: 'We store these details encrypted and share them only with the carrier for the delivery and with staff who handle your order.',
        },
      ],
    },
    {
      id: 'handoff',
      heading: 'Identity check at the handoff',
      blocks: [
        {
          type: 'p',
          text: 'Cash is released only to the verified account holder. At the door you must present valid government-issued photo ID that matches your verified account. The courier will not hand the cash to anyone else, and will not leave it unattended.',
        },
        {
          type: 'p',
          text: 'The courier may refuse or end a handoff if the ID does not match, if they are concerned for safety or about coercion, or if the location is not safe. A failed delivery is shown on your order, and support will arrange another attempt or a bank payout.',
        },
      ],
    },
    {
      id: 'reporting',
      heading: 'Cash-reporting obligations',
      blocks: [
        {
          type: 'p',
          text: 'Cash transactions above thresholds set by law, including amounts aggregated across orders on the same day, must be reported to the US government, and we may ask for more information before delivery. Splitting orders to avoid reporting is prohibited, leads to account closure and may be reported.',
        },
        {
          type: 'p',
          text: 'Any order can be held, rejected or converted to a bank payout after compliance or safety review.',
        },
      ],
    },
    {
      id: 'fees',
      heading: 'Fees',
      blocks: [
        {
          type: 'p',
          text: 'A flat delivery fee applies to each cash delivery. It is shown in your quote before you confirm the order, and the amount handed to you is the amount in your receipt.',
        },
        {
          type: 'review',
          id: 'LR-30',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Before real cash deliveries: state and local licensing analysis for each service area, Currency Transaction Report and aggregation procedures (including Geographic Targeting Orders), a contracted licensed and bonded carrier, in-person verification and audit trail, safety protocols, the delivery fee and minimum, and counsel review of these terms. See docs/compliance-readiness.md section 6.]',
        },
      ],
    },
  ],
};
