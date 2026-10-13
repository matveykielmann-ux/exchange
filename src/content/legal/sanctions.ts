import type { LegalDocument } from './types';

export const SANCTIONS_NOTICE: LegalDocument = {
  slug: 'sanctions',
  title: 'Sanctions and Restricted-Jurisdiction Notice',
  version: '1.0.0',
  effectiveDate: null,
  lastUpdated: '2026-10-13',
  summary:
    '{{brand}} complies with US sanctions laws, is available only in the US states where we offer it, and cannot be used by sanctioned persons or from restricted jurisdictions.',
  acceptance: null,
  sections: [
    {
      id: 'sanctions-compliance',
      heading: 'Sanctions compliance',
      blocks: [
        {
          type: 'p',
          text: "We comply with the economic and trade sanctions administered by the US Department of the Treasury's Office of Foreign Assets Control (OFAC) and other applicable US sanctions laws. These laws prohibit us from dealing with sanctioned persons, entities and jurisdictions, and with property in which they have an interest.",
        },
      ],
    },
    {
      id: 'who-cannot-use',
      heading: 'Who cannot use the Service',
      blocks: [
        { type: 'p', text: 'You may not use the Service if you are:' },
        {
          type: 'list',
          items: [
            "named on, or owned or controlled by a person named on, OFAC's Specially Designated Nationals and Blocked Persons List or any other US sanctions or restricted-party list;",
            'located in, organized in or ordinarily resident in a country or region subject to comprehensive US sanctions; or',
            'acting on behalf of any such person.',
          ],
        },
      ],
    },
    {
      id: 'restricted-jurisdictions',
      heading: 'Where the Service is available',
      blocks: [
        {
          type: 'p',
          text: 'The Service is available only to residents of the US states and territories where we offer it. Residents of other states, and anyone located outside the United States, may not use the Service. We may check your location using your address, identity documents and IP address.',
        },
        {
          type: 'review',
          id: 'LR-02',
          text: '[OWNER/COUNSEL INPUT REQUIRED: The list of US states and territories in which the Service will be offered at launch, and any states expressly excluded (for example New York or California pending licensing). Must match the server-side geo-restriction.]',
        },
        {
          type: 'p',
          text: 'You may not use a VPN, proxy or any other tool to disguise your location or to access the Service from a place where it is not available.',
        },
        {
          type: 'review',
          id: 'LR-28',
          text: '[OWNER/COUNSEL INPUT REQUIRED: The list of comprehensively sanctioned and other restricted jurisdictions (and whether to name them on this page), the IP-geolocation and VPN-detection controls to be applied, and the treatment of customers who travel outside the United States.]',
        },
      ],
    },
    {
      id: 'blockchain-addresses',
      heading: 'Blockchain address screening',
      blocks: [
        {
          type: 'p',
          text: 'We screen blockchain addresses that send deposits to us and the refund addresses you give us. We will not accept deposits from, or send returns to, addresses that are identified on a sanctions list or that we determine are associated with sanctioned persons or other illicit activity.',
        },
      ],
    },
    {
      id: 'what-happens',
      heading: 'What happens if there is a sanctions concern',
      blocks: [
        {
          type: 'p',
          text: 'If a customer, deposit or address raises a sanctions concern, we will hold the order for review. If the law requires, we will block or reject the funds and report them to the government, and we may be unable to return them to you or to tell you why. We may also close the account.',
        },
      ],
    },
    {
      id: 'your-representations',
      heading: 'Your representations',
      blocks: [
        {
          type: 'p',
          text: 'Each time you use the Service, you confirm that you are not a sanctioned person, are not in a restricted jurisdiction, and are not selling assets that belong to or are controlled by a sanctioned person. Tell us immediately if any of this changes.',
        },
      ],
    },
  ],
};
