import type { LegalDocument } from './types';

export const CASH_DELIVERY_TERMS: LegalDocument = {
  slug: 'cash-delivery',
  title: 'Cash Delivery and Pickup Terms',
  version: '1.0.0',
  effectiveDate: null,
  lastUpdated: '2026-10-13',
  summary:
    '{{brand}} does not currently offer cash delivery or cash pickup; this page describes the conditions that would have to apply if the service is ever offered.',
  acceptance: null,
  sections: [
    {
      id: 'not-offered',
      heading: 'Cash delivery and pickup are not currently offered',
      blocks: [
        {
          type: 'p',
          text: '{{brand}} does not offer cash delivery or cash pickup, and you cannot select either as a payout method. Payouts are available only by ACH bank transfer, domestic bank wire or push to an eligible US debit card.',
        },
        {
          type: 'p',
          text: 'Cash payouts will remain unavailable unless and until we have verified the required licensing for each area served, put in place cash-reporting and anti-money-laundering controls, contracted a qualified cash carrier, and completed a legal review for each local area. We have not set a date for this, and we may never offer it.',
        },
        {
          type: 'p',
          text: 'If anyone offers you cash for digital assets in the name of {{brand}}, they are not acting for us. Do not send them anything, and report it to us at {{supportEmail}}.',
        },
      ],
    },
    {
      id: 'conditions-if-offered',
      heading: 'Conditions that would apply if cash payouts are offered',
      blocks: [
        {
          type: 'p',
          text: 'None of the following is available now. It is provided so you can understand the conditions that would apply. If we ever offer cash payouts, we will publish separate, complete terms and ask you to accept them before you can use the service.',
        },
        {
          type: 'list',
          items: [
            'Availability: cash payouts would be offered only in specific areas where they are permitted, and only to fully verified customers.',
            'In-person identity re-verification: the person receiving the cash would have to be the account holder and would have to present valid government-issued photo ID that matches the verified account at the handoff. Cash would not be released to anyone else.',
            'Amount caps: cash payouts would be subject to per-order and per-period limits lower than those for bank payouts.',
            'Cash-reporting obligations: cash transactions above thresholds set by law, including amounts aggregated across orders on the same day, must be reported to the US government, and additional information may be required. Splitting orders to avoid reporting would be prohibited and would lead to account closure and may be reported.',
            'Safety rules: handoffs would take place only at approved public locations during set hours. The carrier could refuse or end a handoff if they had any concern for safety, coercion or the identity of the recipient.',
            'Additional review: any order could be held, rejected or converted to a bank payout after compliance or safety review.',
          ],
        },
        {
          type: 'review',
          id: 'LR-30',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Before cash payouts can be offered: state and local licensing analysis for each service area, Currency Transaction Report and aggregation procedures (including Geographic Targeting Orders), contracted licensed and bonded carrier and its insurance, amount caps, in-person verification and audit trail, safety protocols, and complete customer terms. See docs/compliance-readiness.md section 6. Must not be published as available until signed off.]',
        },
      ],
    },
  ],
};
