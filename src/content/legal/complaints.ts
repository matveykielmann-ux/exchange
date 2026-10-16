import type { LegalDocument } from './types';

export const COMPLAINTS_POLICY: LegalDocument = {
  slug: 'complaints',
  title: 'Complaints and Support Policy',
  version: '3.0.0',
  effectiveDate: '2026-03-01',
  lastUpdated: '2026-03-01',
  summary: 'This policy explains how to get help from {{brand}}, how to make a complaint, and what happens after you do. In effect from March 1, 2026.',
  acceptance: null,
  sections: [
    {
      id: 'getting-help',
      heading: 'Getting help',
      blocks: [
        {
          type: 'p',
          text: 'You can contact our support team through the support chat in the Service or through Telegram ({{supportTelegram}}) or in-app support messages. Your support chat history is saved in your account so that you and our team can refer back to it.',
        },
        {
          type: 'p',
          text: 'To help us respond, include your order reference and a description of the issue. Never send us your password, one-time codes, seed phrase or private keys; we will never ask for them.',
        },
        {
          type: 'p',
          text: 'We respond to messages as soon as we reasonably can. Response times vary with the type of request and the volume we are handling, and are not guaranteed.',
        },
      ],
    },
    {
      id: 'making-a-complaint',
      heading: 'Making a complaint',
      blocks: [
        {
          type: 'p',
          text: 'If you are not satisfied with our service or a decision we have made, you can make a complaint by email through Telegram ({{supportTelegram}}) or in-app support messages or through the support chat. Please include:',
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
      ],
    },
    {
      id: 'if-you-are-not-satisfied',
      heading: 'If you are not satisfied',
      blocks: [
        {
          type: 'p',
          text: 'Disputes are settled as Section 16 of the Service Rules provides:',
        },
        { type: 'rules', refs: ['16'] },
        {
          type: 'p',
          text: 'Under Section 11 of the Service Rules, filing complaints with payment system operators about the Service’s actions without first contacting the Company’s support is one of the cases in which the Company may restrict access to the Service or refuse service.',
        },
      ],
    },
    {
      id: 'fraud-and-scams',
      heading: 'Reporting fraud or scams',
      blocks: [
        {
          type: 'p',
          text: "If you think you have been the victim of a scam, or that someone has accessed your account, contact us immediately through the support chat or through Telegram ({{supportTelegram}}). You can also report fraud to the Federal Trade Commission at reportfraud.ftc.gov and to the FBI's Internet Crime Complaint Center at ic3.gov.",
        },
      ],
    },
  ],
};
