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
    q: 'Can I exchange real funds today?',
    a: (
      <p>
        Not yet. Exchanges open only once our payment, custody and verification providers are connected and approved. Until then, the
        sandbox simulates prices, verification and transactions, and no real funds can be sent or received. The{' '}
        <Link to="/legal/terms">Service Rules</Link> set out the terms that will apply to every Exchange Request.
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
        Always match the network on the deposit screen to the network your wallet uses to send. Under clause 9.9 of the{' '}
        <Link to="/legal/terms#clause-9-9">Service Rules</Link>, the possibility of a refund for crypto assets sent to the wrong network is
        determined on a case-by-case basis, and the Service reserves the right to refuse it.
      </p>
    ),
  },
  {
    group: 'Deposits',
    q: 'Why do you need a refund address?',
    a: (
      <p>
        If an exchange can't be completed, for example after a failed review, the crypto is returned to the refund address you provide.
        Returns follow Section 9 of the <Link to="/legal/refunds">Service Rules</Link>, including the return fees in clauses 9.7 and 9.8.
      </p>
    ),
  },
  {
    group: 'Deposits',
    q: 'How many confirmations does a deposit need?',
    a: (
      <p>
        Section 5 of the <Link to="/legal/terms#5-rules-for-rate-fixation">Service Rules</Link> sets 4 confirmations for BTC, and 21 for ETH
        and for USDT and USDC on TRC-20, ERC-20 and BEP-20. The count for your network is shown when you choose it.
      </p>
    ),
  },
  {
    group: 'Deposits',
    q: 'Can I cancel after I have sent my crypto?',
    a: (
      <p>
        Clause 4.11 of the Service Rules lets you cancel an Exchange Request before the transaction is completed, except as provided in
        Sections 8 and 13. Contact support with your order reference. If you cancel after sending funds and before the exchange is
        completed, the return is made with retention of direct return costs and possible Company losses, up to 5% of the exchanged amount
        (clause 9.2). Returns are processed within 72 hours of the request, except as provided in Sections 8 and 13. See the{' '}
        <Link to="/legal/refunds">refund policy</Link>.
      </p>
    ),
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
        Yes. Choose <Link to="/cash-delivery">cash by courier</Link> as your payout method and give a US delivery address, a phone number
        and a preferred delivery window. A courier hands the cash only to you, after checking a photo ID that matches your verified account.
        You need a verified account, and the delivery area is checked by ZIP code.
      </p>
    ),
  },
  {
    group: 'Payouts',
    q: 'What is the largest amount I can sell online?',
    a: <p>There is no maximum. The minimum is {formatUsd(PRICING_POLICY.minimumCents)}. Any order may be reviewed before payout.</p>,
  },
  {
    group: 'Accounts & safety',
    q: 'Will anyone from your team ask me to send crypto?',
    a: (
      <p>
        No. We will never call, text or message you asking you to send crypto, share a code, or move money "to keep it safe". That is a
        scam. Stop and contact your bank or local law enforcement. Only contacts listed on the website are official (clause 4.21 of the{' '}
        <Link to="/legal/terms#clause-4-21">Service Rules</Link>).
      </p>
    ),
  },
  {
    group: 'Accounts & safety',
    q: 'Why do I need to verify my identity?',
    a: (
      <p>
        Under Section 8 of the <Link to="/legal/kyc-aml">Service Rules</Link>, we verify identity to ensure Service security and comply with
        anti-money laundering (AML) and counter-terrorism financing (CTF) laws, and we may request additional documents for a specific
        transaction if it is classified as high-risk. We use an identity-verification provider for this. In the sandbox, verification is
        simulated and no documents are collected.
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
