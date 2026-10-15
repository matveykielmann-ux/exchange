import type { LegalDocument } from './types';

export const RISK_DISCLOSURE: LegalDocument = {
  slug: 'risk',
  title: 'Risk Disclosure',
  version: '2.0.0',
  effectiveDate: null,
  lastUpdated: '2026-10-14',
  summary:
    'Selling digital assets carries real risks, including price changes, irreversible blockchain transactions, scams and the absence of government deposit insurance, and you should understand them before you place an order.',
  acceptance: 'order',
  sections: [
    {
      id: 'not-legal-tender',
      heading: 'Digital assets are not legal tender and are not insured',
      blocks: [
        {
          type: 'p',
          text: 'Digital assets such as Bitcoin, Ether, USDT and USDC are not legal tender in the United States and are not backed by the US government. They are not deposits and are not insured by the Federal Deposit Insurance Corporation (FDIC). They are not protected by the Securities Investor Protection Corporation (SIPC).',
        },
        {
          type: 'p',
          text: 'Digital assets you send to {{brand}} are not held in a bank account in your name, and US dollars due to you are not FDIC-insured deposits while your payout is being processed.',
        },
        {
          type: 'review',
          id: 'LR-05',
          text: '[OWNER/COUNSEL INPUT REQUIRED: Any state-mandated consumer disclosures that must appear in the Service Rules, the Risk Disclosure, receipts or complaint notices (for example 23 NYCRR Part 200 disclosures in New York, California DFAL disclosures, and state regulator contact details for complaints).]',
        },
      ],
    },
    {
      id: 'price-volatility',
      heading: 'Prices change quickly',
      blocks: [
        {
          type: 'p',
          text: 'The market prices of digital assets can rise or fall sharply within minutes. Indicative prices shown before you lock a quote change with the market. A locked quote holds its rate only for a limited time, currently 60 seconds, and only for a conforming deposit sent within the deposit window, currently 30 minutes. If you miss either window, the price available to you may be lower.',
        },
        {
          type: 'p',
          text: 'Past prices do not predict future prices. {{brand}} does not give investment advice, and nothing in the Service is a recommendation to sell or hold any asset.',
        },
      ],
    },
    {
      id: 'stablecoin-risk',
      heading: 'Stablecoins can lose their peg',
      blocks: [
        {
          type: 'p',
          text: 'USDT and USDC are designed to track the US dollar, but they are issued by private companies, not by any government, and their value depends on the issuer and its reserves. A stablecoin can trade below one dollar, sometimes significantly, and an issuer can freeze tokens held at particular addresses. The price we quote for a stablecoin reflects the market and may be less than one dollar.',
        },
      ],
    },
    {
      id: 'irreversibility',
      heading: 'Blockchain transactions cannot be reversed',
      blocks: [
        {
          type: 'p',
          text: 'Once you send a digital asset, the transaction cannot be cancelled or reversed by you, by us or by anyone else. If you send the wrong amount, use the wrong network or send to the wrong address, you may lose some or all of your funds. Assets sent on a network we do not support may be permanently unrecoverable. Read the Cryptocurrency Transaction and Irreversibility Disclosure before you send anything.',
        },
      ],
    },
    {
      id: 'network-risk',
      heading: 'Networks can be slow, congested or disrupted',
      blocks: [
        {
          type: 'p',
          text: 'Blockchain networks are operated by independent participants that {{brand}} does not control. Congestion can delay confirmations and raise network fees. Networks can also experience outages, forks, reorganizations or software defects. A delay on the network can cause your deposit to arrive after the deposit window closes, in which case it will not be paid at the locked rate.',
        },
      ],
    },
    {
      id: 'scams',
      heading: 'Scams and fraud',
      blocks: [
        {
          type: 'p',
          text: 'Criminals use digital assets because transactions are hard to reverse. Stop and contact us before placing an order if anyone:',
        },
        {
          type: 'list',
          items: [
            'claims to be from a government agency, law enforcement, a bank, a technology company or {{brand}} and tells you to move or sell your assets;',
            'promises guaranteed returns or pressures you to act quickly;',
            'met you online and asks for money or investment, or for help moving money;',
            'asks you to sell digital assets and send them the proceeds, or to use your bank account to receive funds for them; or',
            'asks for your password, one-time codes, seed phrase or private keys.',
          ],
        },
        {
          type: 'p',
          text: 'We may hold, question or decline an order if we believe you may be the victim of a scam. Once proceeds have been paid out to you and you send them on, we cannot recover them.',
        },
        { type: 'rules', refs: ['4.21'] },
      ],
    },
    {
      id: 'service-and-regulatory-risk',
      heading: 'Service and regulatory risk',
      blocks: [
        {
          type: 'p',
          text: 'Orders can be held for compliance review, which can delay your payout. Payout times are estimates and are not guaranteed. Laws and regulations that apply to digital assets are changing; changes could limit the assets, networks, payout methods or states we can serve, or require us to collect more information from you.',
        },
        {
          type: 'p',
          text: 'Like any online service, {{brand}} can be affected by outages, cyberattacks or failures at our service providers, which could delay or prevent an order from completing. The Service Rules provide:',
        },
        { type: 'rules', refs: ['4.15', '4.20', '12', '13'] },
      ],
    },
    {
      id: 'taxes',
      heading: 'Taxes',
      blocks: [
        {
          type: 'p',
          text: 'Selling digital assets may be a taxable event. Consult a tax professional about your situation. Section 10 of the Service Rules provides:',
        },
        { type: 'rules', refs: ['10'] },
      ],
    },
  ],
};
