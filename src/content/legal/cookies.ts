import type { LegalDocument } from './types';

export const COOKIE_POLICY: LegalDocument = {
  slug: 'cookies',
  title: 'Cookie Policy',
  version: '1.0.0',
  effectiveDate: null,
  lastUpdated: '2026-10-13',
  summary:
    '{{brand}} uses only the cookies and browser storage needed to sign you in, protect your account and remember your display preference; we use no analytics, advertising or third-party tracking cookies.',
  acceptance: null,
  sections: [
    {
      id: 'what-cookies-are',
      heading: 'What cookies and browser storage are',
      blocks: [
        {
          type: 'p',
          text: 'Cookies are small files that a website stores in your browser. Browser storage (local storage and session storage) works in a similar way but is read only by the website itself, in your browser, and is not sent to our servers automatically.',
        },
      ],
    },
    {
      id: 'what-we-use',
      heading: 'What we use',
      blocks: [
        {
          type: 'p',
          text: 'Strictly necessary cookies. The Service cannot work without these, so they cannot be switched off in the Service:',
        },
        {
          type: 'list',
          items: [
            'arcvale_session: keeps you signed in and links your requests to your account. It is marked httpOnly, so scripts in the page cannot read it.',
            'arcvale_csrf: protects the forms you submit against cross-site request forgery, a type of attack in which another site tries to act on your behalf.',
          ],
        },
        { type: 'p', text: 'Browser storage:' },
        {
          type: 'list',
          items: [
            'arcvale.theme (local storage): remembers whether you chose the light or dark display. It stays in your browser until you clear it.',
            'Exchange draft (session storage): holds the details of an exchange you are part-way through so they survive a page reload. It is removed when you close the browser tab.',
          ],
        },
        {
          type: 'review',
          id: 'LR-26',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Expiry periods of the arcvale_session and arcvale_csrf cookies, and confirmation before launch that this inventory matches production (including any cookies set by identity-verification or payout provider components embedded in the Service).]',
        },
      ],
    },
    {
      id: 'what-we-do-not-use',
      heading: 'What we do not use',
      blocks: [
        {
          type: 'p',
          text: 'We do not use analytics cookies, advertising cookies, social media pixels or any other third-party tracking technology, and we do not allow third parties to track you across other websites through the Service.',
        },
        {
          type: 'p',
          text: 'If we ever decide to use cookies other than those listed here, we will update this policy first and, where the law requires it, ask for your consent.',
        },
      ],
    },
    {
      id: 'managing-cookies',
      heading: 'Managing cookies and storage',
      blocks: [
        {
          type: 'p',
          text: 'You can delete or block cookies and clear browser storage in your browser settings. If you block strictly necessary cookies, you will not be able to sign in or submit forms. Clearing local storage resets your display preference to the default.',
        },
      ],
    },
    {
      id: 'contact',
      heading: 'Questions',
      blocks: [{ type: 'p', text: 'Questions about this policy can be sent to {{supportEmail}}.' }],
    },
  ],
};
