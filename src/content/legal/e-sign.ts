import type { LegalDocument } from './types';

export const ELECTRONIC_COMMUNICATIONS_CONSENT: LegalDocument = {
  slug: 'e-sign',
  title: 'Electronic Communications Consent',
  version: '1.0.1',
  effectiveDate: null,
  lastUpdated: '2026-10-14',
  summary:
    'By agreeing to this consent, you allow {{brand}} to provide agreements, disclosures, receipts and notices to you electronically instead of on paper.',
  acceptance: 'signup',
  sections: [
    {
      id: 'scope',
      heading: 'What you are agreeing to',
      blocks: [
        {
          type: 'p',
          text: 'This consent is given under the federal Electronic Signatures in Global and National Commerce Act (E-SIGN Act). It applies to every communication we provide to you in connection with your account and the Service, including:',
        },
        {
          type: 'list',
          items: [
            'the Service Rules, Privacy Policy and other legal documents, and any changes to them;',
            'quotes, order confirmations, receipts and transaction statuses;',
            'disclosures we are required by law to give you, including fee, risk and privacy disclosures;',
            'notices about your account, verification requests, compliance reviews, rejected or returned deposits and payouts; and',
            'responses to support requests and complaints.',
          ],
        },
        {
          type: 'p',
          text: 'You also agree that clicking a button or checking a box to accept a document or confirm an order is your electronic signature and has the same effect as a handwritten signature.',
        },
        {
          type: 'review',
          id: 'LR-46',
          text: '[OWNER/COUNSEL INPUT REQUIRED: This consent refers to the US E-SIGN Act, while the Service Rules are governed by the laws of the Republic of Panama (Section 16). Confirm which electronic-signature and electronic-communications law the consent should rely on.]',
        },
      ],
    },
    {
      id: 'how-we-deliver',
      heading: 'How we deliver communications',
      blocks: [
        {
          type: 'p',
          text: 'We provide communications by displaying them in the Service, by sending them to the email address on your account, or by sending an email that tells you a communication is available in the Service. A communication is treated as delivered when we post it in the Service or send it to your email address, whether or not you open it.',
        },
        {
          type: 'p',
          text: 'You can view the current version of each legal document at any time on the Legal pages of the Service. Your order receipts and statuses remain available in your transaction history while your account is open.',
        },
      ],
    },
    {
      id: 'system-requirements',
      heading: 'Hardware and software you need',
      blocks: [
        { type: 'p', text: 'To access and keep electronic communications, you need:' },
        {
          type: 'list',
          items: [
            'a device with an internet connection;',
            'a current version of a widely used web browser, with cookies enabled for our site;',
            'a valid email address that you can access; and',
            'the ability to save or print web pages or emails, or enough storage on your device to keep copies.',
          ],
        },
        {
          type: 'p',
          text: 'If we change these requirements in a way that creates a material risk that you will not be able to access or keep our communications, we will tell you and give you the chance to withdraw your consent without any fee.',
        },
      ],
    },
    {
      id: 'paper-copies',
      heading: 'Paper copies',
      blocks: [
        {
          type: 'p',
          text: 'You can save or print any communication when you receive it. You may also ask us for a paper copy of a communication we have provided electronically by contacting {{supportEmail}}.',
        },
        {
          type: 'review',
          id: 'LR-25',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Whether paper copies will be provided, any fee for them (or confirmation that they are free), how long after delivery they can be requested, and the postal address used to send them.]',
        },
      ],
    },
    {
      id: 'withdrawing-consent',
      heading: 'Withdrawing your consent',
      blocks: [
        {
          type: 'p',
          text: 'You may withdraw this consent at any time by contacting {{supportEmail}}. Because the Service is provided only electronically, withdrawing your consent means we will close your account once any order in progress has been completed or returned. Withdrawal does not affect the legal validity of communications delivered before it takes effect.',
        },
      ],
    },
    {
      id: 'keeping-email-current',
      heading: 'Keeping your email address current',
      blocks: [
        {
          type: 'p',
          text: 'You must keep the email address on your account current and able to receive our messages. You can update it in your account settings. If our emails to you are returned as undeliverable, we may restrict your account until you give us a working email address.',
        },
      ],
    },
  ],
};
