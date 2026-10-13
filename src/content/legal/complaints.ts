import type { LegalDocument } from './types';

export const COMPLAINTS_POLICY: LegalDocument = {
  slug: 'complaints',
  title: 'Complaints and Support Policy',
  version: '1.0.0',
  effectiveDate: null,
  lastUpdated: '2026-10-13',
  summary: 'This policy explains how to get help from {{brand}}, how to make a complaint, and what happens after you do.',
  acceptance: null,
  sections: [
    {
      id: 'getting-help',
      heading: 'Getting help',
      blocks: [
        {
          type: 'p',
          text: 'You can contact our support team through the support chat in the Service or by email at {{supportEmail}}. Your support chat history is saved in your account so that you and our team can refer back to it.',
        },
        {
          type: 'p',
          text: 'To help us respond, include your order reference and a description of the issue. Never send us your password, one-time codes, seed phrase or private keys; we will never ask for them.',
        },
        {
          type: 'p',
          text: 'We respond to messages as soon as we reasonably can. Response times vary with the type of request and the volume we are handling, and are not guaranteed.',
        },
        {
          type: 'review',
          id: 'LR-29',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Support hours, support phone number (if any), dedicated complaints email address, and any response or resolution targets to be published, including any timeframes required by state law for complaint acknowledgement and resolution.]',
        },
      ],
    },
    {
      id: 'making-a-complaint',
      heading: 'Making a complaint',
      blocks: [
        {
          type: 'p',
          text: 'If you are not satisfied with our service or a decision we have made, you can make a complaint by email to {{supportEmail}} or through the support chat. Please include:',
        },
        {
          type: 'list',
          items: [
            'your name and the email address on your account;',
            'the order reference, if the complaint is about an order;',
            'what happened, with dates and any transaction hashes or payout references; and',
            'what you would like us to do to resolve it.',
          ],
        },
      ],
    },
    {
      id: 'how-we-handle-complaints',
      heading: 'How we handle complaints',
      blocks: [
        {
          type: 'list',
          ordered: true,
          items: [
            'We acknowledge your complaint and record it.',
            'We review the relevant records, including your order history, deposit and payout data and support messages, and may ask you for more information.',
            'We send you a written response explaining our decision and any action we will take.',
          ],
        },
        {
          type: 'p',
          text: 'Some matters, such as the details of a compliance review, may be ones we are legally unable to discuss. Making a complaint does not affect any other rights you have.',
        },
        {
          type: 'review',
          id: 'LR-10',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Whether Regulation E (Electronic Fund Transfer Act) or the Remittance Transfer Rule applies to any part of the payout, and if so the required error-resolution, cancellation and disclosure rights to add to these Terms, the Refund Policy and the Complaints Policy.]',
        },
      ],
    },
    {
      id: 'if-you-are-not-satisfied',
      heading: 'If you are not satisfied',
      blocks: [
        {
          type: 'p',
          text: 'If you are not satisfied with our response, you may contact the financial regulator in your state or the Consumer Financial Protection Bureau (consumerfinance.gov). Disputes are otherwise handled as described in the Terms of Service.',
        },
        {
          type: 'review',
          id: 'LR-05',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Any state-mandated consumer disclosures that must appear in these Terms, the Risk Disclosure, receipts or complaint notices (for example 23 NYCRR Part 200 disclosures in New York, California DFAL disclosures, and state regulator contact details for complaints).]',
        },
      ],
    },
    {
      id: 'fraud-and-scams',
      heading: 'Reporting fraud or scams',
      blocks: [
        {
          type: 'p',
          text: "If you think you have been the victim of a scam, or that someone has accessed your account, contact us immediately through the support chat or at {{supportEmail}}. You can also report fraud to the Federal Trade Commission at reportfraud.ftc.gov and to the FBI's Internet Crime Complaint Center at ic3.gov.",
        },
      ],
    },
  ],
};
