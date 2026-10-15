import type { LegalDocument } from './types';

export const ACCESSIBILITY_STATEMENT: LegalDocument = {
  slug: 'accessibility',
  title: 'Accessibility Statement',
  version: '1.0.1',
  effectiveDate: null,
  lastUpdated: '2026-10-14',
  summary:
    '{{brand}} aims to make the Service usable by everyone and targets conformance with the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.',
  acceptance: null,
  sections: [
    {
      id: 'our-commitment',
      heading: 'Our commitment',
      blocks: [
        {
          type: 'p',
          text: 'We want everyone, including people with disabilities, to be able to sell digital assets, read our disclosures and get support. Our target is conformance with WCAG 2.2 level AA across the Service.',
        },
      ],
    },
    {
      id: 'what-we-do',
      heading: 'What we do',
      blocks: [
        {
          type: 'list',
          items: [
            'We run automated accessibility checks (axe) on our pages.',
            'We test keyboard navigation through the exchange flow, including a visible focus indicator.',
            'We check layouts at desktop, tablet and mobile widths (1440, 1024, 768 and 390 pixels) so that content reflows without horizontal scrolling.',
            "We respect your device's reduced-motion setting and offer light and dark display themes.",
          ],
        },
      ],
    },
    {
      id: 'known-limitations',
      heading: 'Known limitations',
      blocks: [
        {
          type: 'p',
          text: "Despite our efforts, some parts of the Service may not yet be fully accessible. Identity verification is performed through a third-party provider's interface, which we do not fully control. Automated tools cannot detect every issue, and we continue to review and improve the Service.",
        },
        {
          type: 'review',
          id: 'LR-31',
          text: "[OWNER/COUNSEL INPUT REQUIRED: Results and date of a manual accessibility evaluation (including screen-reader testing), known limitations to list here, accessibility of the identity-verification provider's flow, and any additional contact channel (for example phone or relay service) for accessibility requests.]",
        },
      ],
    },
    {
      id: 'alternative-formats',
      heading: 'Alternative formats and assistance',
      blocks: [
        {
          type: 'p',
          text: 'If you have difficulty using any part of the Service, or need a document such as our Service Rules or a receipt in an alternative format, contact us through the support chat or at {{supportEmail}}. Tell us what you were trying to do and what assistive technology you use, if any, and we will work with you to provide the information or complete the task another way.',
        },
      ],
    },
    {
      id: 'feedback',
      heading: 'Feedback',
      blocks: [
        {
          type: 'p',
          text: 'We welcome feedback on the accessibility of the Service. Please report any barrier you encounter to {{supportEmail}}.',
        },
      ],
    },
  ],
};
