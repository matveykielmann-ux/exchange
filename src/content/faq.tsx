import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { formatUsd } from '@/domain/money';
import { PRICING_POLICY } from '@/domain/quote';

export interface FaqItem {
  q: string;
  a: ReactNode;
  group: 'Getting started' | 'Pricing' | 'Deposits' | 'Payouts' | 'Accounts & safety';
}

export const FAQ: FaqItem[] = [
  {
    group: 'Getting started',
    q: 'Is this a live exchange?',
    a: (
      <p>
        No. This is a preview. Prices, quotes, verification and transactions are simulated, and no real funds can be sent or received. See
        the <Link to="/legal#preview">preview disclosure</Link>.
      </p>
    ),
  },
  {
    group: 'Getting started',
    q: 'Which assets can I sell?',
    a: <p>Bitcoin (BTC), Ether (ETH), Tether (USDT on Ethereum or Tron) and USD Coin (USDC on Ethereum, Solana or Base).</p>,
  },
  {
    group: 'Pricing',
    q: 'How is my payout calculated?',
    a: (
      <p>
        We start from a reference price, show the value of your crypto at that price, then subtract the exchange spread and the payout fee
        as separate lines. The result is what you receive. The lines always add up to the cent.
      </p>
    ),
  },
  {
    group: 'Pricing',
    q: 'What is the spread?',
    a: (
      <p>
        The spread is the difference between the reference price and the rate we pay. We show it in dollars and as a percentage rather than
        building it into the price. See <Link to="/fees">Fees</Link> for the full schedule.
      </p>
    ),
  },
  {
    group: 'Pricing',
    q: 'How long is a quote valid?',
    a: (
      <p>
        On the review screen, a quote holds for {PRICING_POLICY.quoteTtlMs / 1000} seconds. After you confirm, the rate is held for deposits
        that arrive within {PRICING_POLICY.depositWindowMs / 60000} minutes. If your deposit is late, the exchange expires and you can start
        again.
      </p>
    ),
  },
  {
    group: 'Deposits',
    q: 'What happens if I send on the wrong network?',
    a: (
      <p>
        Funds sent on a network other than the one shown may be lost or take a long time to recover. Always match the network on the deposit
        screen to the network your wallet uses to send.
      </p>
    ),
  },
  {
    group: 'Deposits',
    q: 'Why do you need a refund address?',
    a: <p>If an exchange can't be completed, for example after a failed review, we return the crypto to the refund address you provide.</p>,
  },
  {
    group: 'Payouts',
    q: 'How fast will I receive dollars?',
    a: (
      <p>
        Each payout method shows an estimated time. These are estimates, not guarantees. Timing depends on network confirmations, reviews,
        and your bank.
      </p>
    ),
  },
  {
    group: 'Payouts',
    q: 'Can I receive cash?',
    a: (
      <p>
        Not at this time. Courier cash delivery is <Link to="/cash-delivery">disabled</Link> until licensing, cash-reporting, insurance and
        carrier requirements are verified.
      </p>
    ),
  },
  {
    group: 'Payouts',
    q: 'What is the largest amount I can sell online?',
    a: (
      <p>
        {formatUsd(PRICING_POLICY.retailMaximumCents)} per transaction. Larger amounts go through the{' '}
        <Link to="/large-transactions">large-transaction desk</Link>.
      </p>
    ),
  },
  {
    group: 'Accounts & safety',
    q: 'Will anyone from your team ask me to send crypto?',
    a: (
      <p>
        No. We will never call, text or message you asking you to send crypto, share a code, or move money "to keep it safe". That is a
        scam. Stop and contact your bank or local law enforcement.
      </p>
    ),
  },
  {
    group: 'Accounts & safety',
    q: 'Why do I need to verify my identity?',
    a: (
      <p>
        US rules require exchanges to verify customers and screen transactions. In this preview, verification is simulated and no documents
        are collected.
      </p>
    ),
  },
];

export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <Accordion type="multiple" className="faq">
      {items.map((item) => (
        <AccordionItem key={item.q} value={item.q} className="faq__item">
          <AccordionTrigger className="faq__question">{item.q}</AccordionTrigger>
          <AccordionContent className="faq__answer">{item.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
