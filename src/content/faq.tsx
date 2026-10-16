import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PRICING_POLICY } from '@/domain/quote';
import { t } from '@/i18n';

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
        {t(
          'Yes. Place an exchange request after verifying your identity. Our team issues payment details, verifies your deposit, and records the payout. The',
        )}{' '}
        <Link to="/legal/terms">{t('Service Rules')}</Link> {t('set out the terms that apply to every Exchange Request.')}
      </p>
    ),
  },
  {
    group: 'Getting started',
    q: 'Which assets can I sell?',
    a: (
      <p>
        {t(
          'Bitcoin (BTC), Ether (ETH), Tether (USDT), USD Coin (USDC), XRP, Solana (SOL) and BNB — each on the networks shown when you choose the asset.',
        )}
      </p>
    ),
  },
  {
    group: 'Pricing',
    q: 'How is my payout calculated?',
    a: (
      <p>
        {t(
          'The quote shows the market exchange rate, with no spread, and the value of your crypto at that rate. The CryptoBit fee is a separate line: 3% when you sell, 2% when you buy (ACH, wire or debit card), plus any estimated bank wire fee or individually quoted courier cost. The result is what you receive, to the cent.',
        )}
      </p>
    ),
  },
  {
    group: 'Pricing',
    q: 'How long is a quote valid?',
    a: (
      <p>
        {t('On the review screen, a quote holds for')} {PRICING_POLICY.quoteTtlMs / 1000}{' '}
        {t('seconds. After you confirm, the rate is held for deposits that arrive within')} {PRICING_POLICY.depositWindowMs / 60000}{' '}
        {t('minutes. If your deposit is late, the exchange expires and you can start again.')}
      </p>
    ),
  },
  {
    group: 'Deposits',
    q: 'What happens if I send on the wrong network?',
    a: (
      <p>
        {t('Always match the network on the deposit screen to the network your wallet uses to send. Under clause 9.9 of the')}{' '}
        <Link to="/legal/terms#clause-9-9">{t('Service Rules')}</Link>
        {t(
          ', the possibility of a refund for crypto assets sent to the wrong network is determined on a case-by-case basis, and the Service reserves the right to refuse it.',
        )}
      </p>
    ),
  },
  {
    group: 'Deposits',
    q: 'When do you ask for a refund address?',
    a: (
      <p>
        {t(
          "Only if an exchange can't be completed, for example after a failed review. You don't give one up front: we then ask for it on the order page, check it and return the crypto there. Returns follow Section 9 of the",
        )}{' '}
        <Link to="/legal/refunds">{t('Service Rules')}</Link>
        {t(', including the return fees in clauses 9.7 and 9.8.')}
      </p>
    ),
  },
  {
    group: 'Deposits',
    q: 'How many confirmations does a deposit need?',
    a: (
      <p>
        {t('Section 5 of the')} <Link to="/legal/terms#5-rules-for-rate-fixation">{t('Service Rules')}</Link>{' '}
        {t(
          'sets 4 confirmations for BTC, and 21 for ETH and for USDT and USDC on TRC-20, ERC-20 and BEP-20. The count for your network is shown when you choose it.',
        )}
      </p>
    ),
  },
  {
    group: 'Deposits',
    q: 'Can I cancel after I have sent my crypto?',
    a: (
      <p>
        {t(
          'Clause 4.11 of the Service Rules lets you cancel an Exchange Request before the transaction is completed, except as provided in Sections 8 and 13. Contact support with your order reference. If you cancel after sending funds and before the exchange is completed, the return is made with retention of direct return costs and possible Company losses, up to 5% of the exchanged amount (clause 9.2). Returns are processed within 72 hours of the request, except as provided in Sections 8 and 13. See the',
        )}{' '}
        <Link to="/legal/refunds">{t('refund policy')}</Link>.
      </p>
    ),
  },
  {
    group: 'Payouts',
    q: 'How fast will I receive dollars?',
    a: (
      <p>
        {t(
          'Each payout method shows an estimated time. These are estimates, not guarantees. Timing depends on network confirmations, reviews, and your bank.',
        )}
      </p>
    ),
  },
  {
    group: 'Payouts',
    q: 'Can I receive cash?',
    a: (
      <p>
        {t('Yes. Choose')} <Link to="/cash-delivery">{t('cash by courier')}</Link>{' '}
        {t(
          'as your payout method and give a US delivery address, a phone number and a preferred delivery window. A courier hands the cash only to you, after checking a photo ID that matches your verified account. You need a verified account, and the delivery area is checked by ZIP code.',
        )}
      </p>
    ),
  },
  {
    group: 'Payouts',
    q: 'What is the largest amount I can sell online?',
    a: (
      <p>
        {t('There is no published minimum and no maximum.')}
        {t('. Any order may be reviewed before payout.')}
      </p>
    ),
  },
  {
    group: 'Accounts & safety',
    q: 'Will anyone from your team ask me to send crypto?',
    a: (
      <p>
        {t(
          'No. We will never call, text or message you asking you to send crypto, share a code, or move money "to keep it safe". That is a scam. Stop and contact your bank or local law enforcement. Only contacts listed on the website are official (clause 4.21 of the',
        )}{' '}
        <Link to="/legal/terms#clause-4-21">{t('Service Rules')}</Link>).
      </p>
    ),
  },
  {
    group: 'Accounts & safety',
    q: 'Why do I need to verify my identity?',
    a: (
      <p>
        {t('Under Section 8 of the')} <Link to="/legal/kyc-aml">{t('Service Rules')}</Link>
        {t(
          ', we verify identity to ensure Service security and comply with anti-money laundering (AML) and counter-terrorism financing (CTF) laws, and we may request additional documents for a specific transaction if it is classified as high-risk. We use an identity-verification provider for this.',
        )}
      </p>
    ),
  },
];

export function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <Accordion type="multiple" className="faq">
      {items.map((item) => (
        <AccordionItem key={item.q} value={item.q} className="faq__item">
          <AccordionTrigger className="faq__question">{t(item.q)}</AccordionTrigger>
          <AccordionContent className="faq__answer">{item.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
