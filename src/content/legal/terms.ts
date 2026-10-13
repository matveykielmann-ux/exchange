import type { LegalDocument } from './types';

export const TERMS_OF_SERVICE: LegalDocument = {
  slug: 'terms',
  title: 'Terms of Service',
  version: '1.0.0',
  effectiveDate: null,
  lastUpdated: '2026-10-13',
  summary:
    'These Terms are the agreement between you and {{brand}} that governs your account and every sale of digital assets for US dollars you make through the Service.',
  acceptance: 'signup',
  sections: [
    {
      id: 'about-these-terms',
      heading: 'About these Terms',
      blocks: [
        {
          type: 'p',
          text: 'These Terms of Service (the "Terms") form a binding agreement between you and the company that operates {{brand}} ("{{brand}}", "we", "us" or "our"). They govern your use of the {{brand}} website, applications and related services (together, the "Service").',
        },
        {
          type: 'review',
          id: 'LR-01',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Registered legal name and state of formation of the operating entity, which must be named as the contracting party in the Terms, as the business responsible for personal information in the Privacy Policy, and under Regulatory status on the Contact page.]',
        },
        {
          type: 'p',
          text: 'By creating an account or using the Service, you agree to these Terms and to the documents they incorporate: the Privacy Policy, the Electronic Communications Consent, the Risk Disclosure, the Cryptocurrency Transaction and Irreversibility Disclosure, the Fee and Exchange-Rate Disclosure, and the Cancellation, Rejection and Refund Policy. If a provision of these Terms conflicts with a specific disclosure you accept for an individual order, the order-specific disclosure and quote govern that order.',
        },
        {
          type: 'p',
          text: 'Please read these Terms carefully. They limit our liability and explain how disputes are resolved. If you do not agree, do not use the Service.',
        },
      ],
    },
    {
      id: 'eligibility',
      heading: 'Eligibility',
      blocks: [
        { type: 'p', text: 'To use the Service, you must:' },
        {
          type: 'list',
          items: [
            'be at least 18 years old and have reached the age of majority in the state where you live;',
            'be an individual acting on your own behalf, not on behalf of a business or any other person, unless we have approved a business account in writing;',
            'be a resident of the United States, living in a state or territory where we make the Service available;',
            'not be located in, or a resident of, any jurisdiction described in our Sanctions and Restricted-Jurisdiction Notice;',
            'not be named on, or owned or controlled by a person named on, any US government sanctions or restricted-party list; and',
            'not have had an account with us previously closed for a violation of these Terms.',
          ],
        },
        {
          type: 'p',
          text: 'The Service is not available in every state. We will tell you during sign-up if it is not available where you live. We may change the states in which the Service is available, and we may ask you to confirm your residence at any time.',
        },
        {
          type: 'review',
          id: 'LR-02',
          text: '[OWNER/COUNSEL INPUT REQUIRED: The list of US states and territories in which the Service will be offered at launch, and any states expressly excluded (for example New York or California pending licensing). Must match the server-side geo-restriction.]',
        },
      ],
    },
    {
      id: 'your-account',
      heading: 'Your account',
      blocks: [
        {
          type: 'p',
          text: 'You must give us accurate, current and complete information when you create your account and keep it up to date. You may hold only one account. You may not open an account for, or let anyone else use, your account.',
        },
        {
          type: 'p',
          text: 'You are responsible for keeping your password and any other sign-in credentials confidential and for all activity in your account. Use a strong password that you do not use elsewhere. If you believe your account has been accessed without your permission, contact us immediately at {{supportEmail}} and change your password.',
        },
        {
          type: 'p',
          text: 'We will never ask you for your password, a one-time code, or your wallet seed phrase or private keys. Anyone who does is not acting for {{brand}}.',
        },
      ],
    },
    {
      id: 'the-service',
      heading: 'What the Service does',
      blocks: [
        {
          type: 'p',
          text: 'The Service lets you sell supported digital assets and receive US dollars. It does not let you buy digital assets, hold a balance, send digital assets to other people, or store digital assets with us. {{brand}} does not provide investment, tax or legal advice.',
        },
        { type: 'p', text: 'We currently support the following assets and networks:' },
        {
          type: 'list',
          items: [
            'Bitcoin (BTC) on the Bitcoin network;',
            'Ether (ETH) on the Ethereum network;',
            'Tether (USDT) as an ERC-20 token on Ethereum or a TRC-20 token on Tron;',
            'USD Coin (USDC) as an ERC-20 token on Ethereum, an SPL token on Solana, or on Base.',
          ],
        },
        {
          type: 'p',
          text: 'We may add or remove supported assets, networks or payout methods. The assets, networks and payout methods available to you are those shown in the Service when you request a quote.',
        },
        {
          type: 'review',
          id: 'LR-03',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Transaction structure: whether the operating entity buys the digital asset from the customer as principal or arranges the sale as agent; who controls the deposit addresses; whether any third-party custodian or liquidity provider is involved; and how that must be described here.]',
        },
        {
          type: 'p',
          text: 'Orders worth about $25,000 or more are handled by our large-transaction desk rather than the standard online flow. Large-transaction requests are subject to additional review, are priced individually, and are confirmed with you separately before you send any funds. The standard online minimum and maximum order amounts are shown in the Service.',
        },
        {
          type: 'review',
          id: 'LR-04',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Money transmitter and virtual-currency licensing status for each state served, including New York (BitLicense / money transmitter license) and California (DFAL). The Service must not be offered in a state until its licensing position is confirmed.]',
        },
        {
          type: 'review',
          id: 'LR-05',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Any state-mandated consumer disclosures that must appear in these Terms, the Risk Disclosure, receipts or complaint notices (for example 23 NYCRR Part 200 disclosures in New York, California DFAL disclosures, and state regulator contact details for complaints).]',
        },
      ],
    },
    {
      id: 'quotes',
      heading: 'Quotes and pricing',
      blocks: [
        {
          type: 'p',
          text: 'Before you confirm an order, we show you an itemized quote with the reference price, our spread, the payout fee and the net amount in US dollars you will receive. Prices shown before you lock a quote are indicative and change with the market.',
        },
        {
          type: 'p',
          text: 'When you lock a quote, its rate is held for a limited time, currently 60 seconds. If the quote expires before you confirm, you must refresh it, and the new quote may be higher or lower. The quote you accept when you confirm the order governs that order, subject to you making a conforming deposit as described below.',
        },
        {
          type: 'p',
          text: 'We may decline to provide a quote, or cancel an order before payout, if the quote was based on a clear and obvious pricing error or a material disruption in the market data we rely on. If we do so after you have deposited, we will tell you and either offer you a corrected quote, which you may decline, or return your deposit as described in the Cancellation, Rejection and Refund Policy.',
        },
        {
          type: 'review',
          id: 'LR-06',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Confirm the policy for honoring or cancelling locked quotes affected by obvious pricing errors or market disruption, including whether a corrected quote must be offered and how the customer is notified.]',
        },
      ],
    },
    {
      id: 'deposits',
      heading: 'Sending your deposit',
      blocks: [
        {
          type: 'p',
          text: 'After you confirm an order, we give you a deposit address, the exact amount to send and the network to use. You then have a deposit window, currently 30 minutes, to send that exact amount on that network. You are responsible for the accuracy of the transaction you send from your wallet, including the network and any network fees.',
        },
        {
          type: 'p',
          text: 'A deposit counts only once our systems have observed it on the blockchain with the number of network confirmations we require for that network. A transaction hash, screenshot or statement that you have sent funds is not proof of a deposit, and we cannot treat a deposit as received until we observe it ourselves.',
        },
        {
          type: 'review',
          id: 'LR-07',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Required number of network confirmations for each supported asset and network, whether these are published in the Service or in this document, and whether the deposit window is measured to the first observation of the transaction or to the required confirmations.]',
        },
        {
          type: 'p',
          text: 'You must send your deposit from a wallet that you own or control. We may ask you to show that you control the sending wallet.',
        },
        {
          type: 'p',
          text: 'A deposit that arrives after the deposit window closes, in an amount different from the quoted amount, or on a different network will not be paid at the locked rate. After review, an eligible deposit of this kind will be returned to the refund address you gave us, less network fees. A deposit sent on a network we do not support may be permanently unrecoverable. Details are in the Cryptocurrency Transaction and Irreversibility Disclosure and the Cancellation, Rejection and Refund Policy.',
        },
        {
          type: 'review',
          id: 'LR-08',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Policy for non-conforming deposits (late, wrong amount, wrong supported network): whether a new quote at the current rate may be offered as an alternative to return; any handling fee beyond network fees; the minimum amount worth returning when network fees exceed the deposit; and the target review timeframe.]',
        },
      ],
    },
    {
      id: 'payouts',
      heading: 'Payouts',
      blocks: [
        {
          type: 'p',
          text: 'You can receive your US dollar payout by ACH bank transfer, domestic bank wire, or push payment to an eligible US debit card, subject to the minimums, maximums and eligibility rules shown in the Service. Payouts may be made only to a bank account or debit card held in your own name in the United States.',
        },
        {
          type: 'p',
          text: 'We start a payout only after your deposit has been confirmed and any required review is complete. We describe a payout as sent only once our payout provider confirms it. Payout timing is an estimate and is not guaranteed. Current estimates are: ACH, 1 to 3 business days; domestic wire, the same or next business day; debit card, within 30 minutes, although it can take longer. Your bank or card issuer may take additional time to make funds available.',
        },
        {
          type: 'p',
          text: 'You are responsible for giving us correct payout details. If a payout is returned or rejected because the details are wrong or the account cannot receive it, we will contact you to arrange another payout method. We may be unable to recover a payout sent to an account number you gave us that belongs to someone else.',
        },
        {
          type: 'review',
          id: 'LR-09',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Identity of the payout provider(s) and any bank that originates ACH, wire or card payouts; how US dollar proceeds are held between deposit confirmation and payout (for example segregated or trust accounts); and whether that must be disclosed here.]',
        },
        {
          type: 'review',
          id: 'LR-10',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Whether Regulation E (Electronic Fund Transfer Act) or the Remittance Transfer Rule applies to any part of the payout, and if so the required error-resolution, cancellation and disclosure rights to add to these Terms, the Refund Policy and the Complaints Policy.]',
        },
      ],
    },
    {
      id: 'verification-and-compliance',
      heading: 'Identity verification and compliance reviews',
      blocks: [
        {
          type: 'p',
          text: 'We are required to verify the identity of our customers and to monitor transactions for fraud, money laundering, sanctions and other legal risks. You agree to provide the information and documents we request, and you authorize us and our identity-verification and screening providers to verify that information, including against third-party databases. Our Identity Verification and AML/KYC Notice explains what we may ask for.',
        },
        {
          type: 'review',
          id: 'LR-11',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Names of the contracted identity-verification, sanctions-screening and blockchain-analytics providers, if they must be identified to customers, and any provider terms the customer must accept.]',
        },
        {
          type: 'p',
          text: 'Any order may be held for review at any stage. During a review we may ask you for more information, delay the order, decline to complete it, or return your deposit. We may be legally prohibited from telling you the reason for a review or a decision. We may report activity to government authorities where required by law, and we may freeze or block funds where the law requires us to.',
        },
        {
          type: 'p',
          text: 'We may set or change limits on the amount or number of orders you can place, based on your verification level, account history or our risk assessment.',
        },
      ],
    },
    {
      id: 'prohibited-use',
      heading: 'Prohibited use',
      blocks: [
        { type: 'p', text: 'You may not use the Service, or help anyone else use it:' },
        {
          type: 'list',
          items: [
            'to sell digital assets that you do not own, that are proceeds of crime, or that you obtained through fraud, theft, ransomware or any other unlawful activity;',
            'on behalf of another person, or at the direction of someone who has contacted you claiming to be from a government agency, bank, technology company or law enforcement, or who has promised you an investment return or a relationship;',
            'to evade sanctions, reporting obligations or our limits, including by splitting transactions to avoid thresholds;',
            'with information, documents or images that are false, altered or belong to someone else;',
            'from a restricted jurisdiction, or by using a VPN, proxy or other tool to disguise your location;',
            'to interfere with, probe, scrape, reverse-engineer or overload the Service, or to access it by automated means without our written permission; or',
            'in any other way that breaks the law or these Terms.',
          ],
        },
        {
          type: 'p',
          text: 'If someone has asked you to sell digital assets and send them the proceeds, stop and contact us before you send anything. This is a common sign of a scam.',
        },
      ],
    },
    {
      id: 'fees',
      heading: 'Fees',
      blocks: [
        {
          type: 'p',
          text: 'Our fees are a spread, applied to the reference price, and a payout fee that depends on the payout method you choose. Current fee schedules are shown on the Fees page and every fee that applies to your order is itemized in your quote before you confirm. The quote you accept governs the fees for that order. We may change our fee schedules, but changes do not affect an order you have already confirmed.',
        },
        {
          type: 'p',
          text: 'Network fees for sending digital assets are paid by you to the blockchain network, not to {{brand}}. Your bank or card issuer may also charge its own fees. See the Fee and Exchange-Rate Disclosure for details.',
        },
      ],
    },
    {
      id: 'cancellations-and-refunds',
      heading: 'Cancellations, rejections and refunds',
      blocks: [
        {
          type: 'p',
          text: 'If you do not send your deposit before the deposit window closes, the order expires and nothing further is owed by either of us. Once your deposit has been sent on the blockchain, you cannot reverse it, and once our systems have confirmed a conforming deposit you cannot cancel the order.',
        },
        {
          type: 'p',
          text: 'If we reject an order, or a deposit does not conform to the order, any eligible return is made in the same digital asset to your refund address, less network fees, after review. We do not refund deposits in US dollars or to any address other than your refund address unless the law requires otherwise. The Cancellation, Rejection and Refund Policy sets out the full rules.',
        },
      ],
    },
    {
      id: 'test-environment',
      heading: 'Test (sandbox) environment',
      blocks: [
        {
          type: 'p',
          text: 'We may operate a version of the Service in sandbox, or test, mode. In sandbox mode all prices, quotes, deposits, verification results, statuses and payouts are simulated and are marked as such. Sandbox activity never moves real money or real digital assets, creates no obligation on either of us to pay or deliver anything, and is not a record of any real transaction.',
        },
        {
          type: 'p',
          text: 'Never send real digital assets to an address displayed in sandbox mode. Sandbox addresses are placeholders that are not valid on any blockchain, and anything sent in an attempt to use them may be lost.',
        },
      ],
    },
    {
      id: 'electronic-communications',
      heading: 'Electronic communications',
      blocks: [
        {
          type: 'p',
          text: 'You agree to receive these Terms, disclosures, quotes, receipts, notices and other communications from us electronically, as described in the Electronic Communications Consent. You are responsible for keeping your email address current and for checking your account and email for notices.',
        },
      ],
    },
    {
      id: 'intellectual-property',
      heading: 'Intellectual property',
      blocks: [
        {
          type: 'p',
          text: 'The Service, including its software, design, text and graphics, and the {{brand}} name and logo, belong to us or our licensors. We give you a limited, personal, non-exclusive, non-transferable and revocable license to use the Service for its intended purpose under these Terms. You may not copy, modify, distribute or create derivative works from any part of the Service except as the law allows.',
        },
        {
          type: 'p',
          text: 'If you send us feedback or suggestions, you allow us to use them without any obligation to you.',
        },
        {
          type: 'review',
          id: 'LR-12',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Trademark clearance and ownership of the "Arcvale" name and logo, and the entity that owns them.]',
        },
      ],
    },
    {
      id: 'disclaimers',
      heading: 'Disclaimers',
      blocks: [
        {
          type: 'p',
          text: 'Digital assets are not legal tender and are not insured by the Federal Deposit Insurance Corporation (FDIC) or protected by the Securities Investor Protection Corporation (SIPC). Their value can change rapidly and you may lose money. Please read the Risk Disclosure.',
        },
        {
          type: 'p',
          text: 'To the fullest extent the law allows, the Service is provided "as is" and "as available". We do not promise that the Service will be uninterrupted, error-free or available at any particular time, that a quote will be available when you want one, or that any deposit or payout will be completed within an estimated time. We disclaim all implied warranties, including merchantability, fitness for a particular purpose and non-infringement. Some states do not allow these disclaimers, so some of them may not apply to you.',
        },
        {
          type: 'p',
          text: 'We do not control blockchain networks, wallets, banks or card networks and are not responsible for their operation, delays, forks, outages or fees.',
        },
      ],
    },
    {
      id: 'limitation-of-liability',
      heading: 'Limitation of liability',
      blocks: [
        {
          type: 'p',
          text: 'To the fullest extent the law allows, {{brand}} and its officers, employees and service providers will not be liable for any indirect, incidental, special, consequential or punitive damages, or for lost profits, lost opportunity or losses caused by market price movements, arising from your use of the Service, even if we were told such damages were possible.',
        },
        {
          type: 'p',
          text: 'Nothing in these Terms limits liability that cannot be limited under applicable law, including liability for our fraud, gross negligence or willful misconduct, or your rights under consumer-protection laws that cannot be waived.',
        },
        {
          type: 'review',
          id: 'LR-13',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Whether to include an aggregate liability cap (and its amount or formula, for example fees paid on the affected order), and any state-law carve-outs required for consumer contracts.]',
        },
      ],
    },
    {
      id: 'indemnity',
      heading: 'Indemnity',
      blocks: [
        {
          type: 'p',
          text: "To the extent the law allows, you agree to indemnify and hold harmless {{brand}} and its officers, employees and service providers from any claims, losses, liabilities and reasonable expenses, including reasonable attorneys' fees, arising from your breach of these Terms, your violation of law, or your use of the Service with information or funds that are not yours.",
        },
      ],
    },
    {
      id: 'disputes',
      heading: 'Disputes and governing law',
      blocks: [
        {
          type: 'p',
          text: 'If you have a concern, please contact us first. Most issues can be resolved through our Complaints and Support Policy. Before starting any formal proceeding, you and we each agree to send the other a written description of the dispute and to try in good faith to resolve it informally for at least 30 days.',
        },
        {
          type: 'p',
          text: 'These Terms are governed by applicable United States federal law and applicable state law, without regard to conflict-of-laws rules. Nothing in these Terms takes away protections given to you by the consumer-protection laws of your state of residence that cannot be waived by agreement.',
        },
        {
          type: 'review',
          id: 'LR-14',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Governing-law state for these Terms.]',
        },
        {
          type: 'review',
          id: 'LR-15',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Dispute-resolution forum: whether to require individual arbitration (and if so the administrator, rules, fee allocation, opt-out window, small-claims carve-out and mass-arbitration procedures) and a class-action waiver, or instead to specify courts and venue. Enforceability must be reviewed for each served state.]',
        },
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to these Terms or the Service',
      blocks: [
        {
          type: 'p',
          text: 'We may change these Terms. If we make a material change, we will notify you by email or in the Service before the change takes effect and may ask you to accept the new version before you place another order. The version and effective date of these Terms are shown at the top of this page. Changes do not apply to orders you confirmed before the change took effect.',
        },
        {
          type: 'review',
          id: 'LR-16',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Minimum advance-notice period for material changes to these Terms and the Privacy Policy, and whether continued use without re-acceptance is sufficient for any category of change.]',
        },
        {
          type: 'p',
          text: 'We may change, suspend or discontinue any part of the Service, including supported assets, networks and payout methods. We will give you reasonable notice where we can.',
        },
      ],
    },
    {
      id: 'suspension-and-termination',
      heading: 'Suspension and termination',
      blocks: [
        {
          type: 'p',
          text: 'You may close your account at any time by contacting support, as long as you have no order in progress. We may suspend or close your account, or refuse an order, if we reasonably believe you have broken these Terms, if required by law or a government authority, if we cannot verify your identity, or if continuing to serve you would expose you, us or others to legal, fraud or security risk.',
        },
        {
          type: 'p',
          text: 'If we close your account while an order is in progress, we will complete the payout if we lawfully can, or return your deposit to your refund address, less network fees, unless the law requires us to hold or block it. We keep records after an account is closed as described in the Privacy Policy.',
        },
        {
          type: 'p',
          text: 'Sections of these Terms that by their nature should continue after termination, including those on fees owed, disclaimers, limitation of liability, indemnity and disputes, continue to apply.',
        },
        {
          type: 'review',
          id: 'LR-17',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Treatment of funds or digital assets that cannot be paid out or returned (for example closed bank account, unreachable customer, invalid refund address), including escheatment under state unclaimed-property laws and the dormancy periods that apply.]',
        },
      ],
    },
    {
      id: 'general',
      heading: 'General terms',
      blocks: [
        {
          type: 'list',
          items: [
            'These Terms and the documents they incorporate are the entire agreement between you and us about the Service.',
            'If any provision is found unenforceable, the rest of these Terms remain in effect.',
            'Our failure to enforce a provision is not a waiver of our right to do so later.',
            'You may not transfer your rights or obligations under these Terms. We may transfer ours in connection with a merger, acquisition or sale of assets, or as the law permits, and will notify you if we do.',
            'We are not responsible for delays or failures caused by events beyond our reasonable control, including blockchain network failures, bank or payment-network outages, natural disasters and government action.',
            'Headings are for convenience only and do not affect interpretation.',
          ],
        },
      ],
    },
    {
      id: 'contact',
      heading: 'Contact us',
      blocks: [
        {
          type: 'p',
          text: 'Questions about these Terms can be sent to {{supportEmail}} or through the support chat in the Service. Formal legal notices should be sent as described in our Contact and Legal Notices page.',
        },
        {
          type: 'review',
          id: 'LR-18',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Registered address and mailing address for legal notices and service of process.]',
        },
      ],
    },
  ],
};
