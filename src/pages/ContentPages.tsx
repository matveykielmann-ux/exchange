import { SupportContact, TelegramLink } from '@/components/SupportContact';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Notice, PageHeader } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { BRAND, SUPPORT } from '@/config/brand';
import { FAQ, FaqList, type FaqItem } from '@/content/faq';
import { NETWORKS } from '@/domain/assets';
import { formatUsd } from '@/domain/money';
import { describeFee, PAYOUT_METHODS, PAYOUT_ORDER } from '@/domain/payout';
import { PRICING_POLICY } from '@/domain/quote';
import { LiveQuoteExample } from '@/components/LiveQuoteExample';
import { RulesQuote } from '@/components/LegalMarkdown';
import { t } from '@/i18n';

function WithToc({ toc, children }: { toc: Array<[string, string]>; children: ReactNode }) {
  return (
    <div className="container content-grid">
      <nav className="toc" aria-label={t('On this page')}>
        <p className="eyebrow">{t('On this page')}</p>
        {toc.map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {t(label)}
          </a>
        ))}
      </nav>
      <div className="prose">{children}</div>
    </div>
  );
}

/* ---------------- How it works ---------------- */
export function HowItWorksPage() {
  useDocumentTitle('How it works');
  return (
    <>
      <PageHeader
        eyebrow={t('How it works')}
        title={t('From crypto to dollars, step by step.')}
        lead={t('One quote, one confirmation and one status page cover the whole exchange.')}
      />
      <WithToc
        toc={[
          ['quote', '1. Quote'],
          ['payout', '2. Payout'],
          ['details', '3. Details'],
          ['confirm', '4. Confirm'],
          ['deposit', '5. Deposit'],
          ['payout-sent', '6. Payout'],
        ]}
      >
        <h2 id="quote">{t('1. Get a quote')}</h2>
        <p>
          {t(
            "Choose the asset and the network you'll send on, then enter an amount. You see the market exchange rate, the value of your crypto at that rate and the fee, all before you share any personal details.",
          )}
        </p>
        <h2 id="payout">{t('2. Choose a payout method')}</h2>
        <p>
          {t(
            "Bank transfer (ACH), domestic wire, or debit card. Each shows its fee and estimated timing. Methods that can't take your amount are shown and explained, not hidden.",
          )}
        </p>
        <h2 id="details">{t('3. Add your details')}</h2>
        <p>
          {t(
            "Sign in and choose or add the account that will receive dollars. No refund address is needed up front: if the exchange can't be completed, we ask for one on the order page.",
          )}
        </p>
        <h2 id="confirm">{t('4. Review and confirm')}</h2>
        <p>
          {t('We lock a quote for')} {PRICING_POLICY.quoteTtlMs / 1000}{' '}
          {t(
            'seconds while you review it. Your identity must be verified first. When you confirm, the rate holds for deposits that arrive within',
          )}{' '}
          {PRICING_POLICY.depositWindowMs / 60000} {t('minutes.')}
        </p>
        <h2 id="deposit">{t('5. Send your crypto')}</h2>
        <p>
          {t(
            'Send exactly the amount shown to the deposit address shown, on the network shown. We wait for the required number of network confirmations, then screen the transaction. Clause 4.22 of the',
          )}{' '}
          <Link to="/legal/terms#clause-4-22">{t('Service Rules')}</Link>{' '}
          {t(
            'asks you to provide confirmation of the transfer: a screenshot showing the time, the wallet address, the amount and the TXID or blockchain link. You can give the transaction hash on the order page.',
          )}
        </p>
        <div className="table-wrap" tabIndex={0} role="region" aria-label={t('Deposit steps')}>
          <table className="data-table data-table--stack">
            <caption>{t('Required confirmations')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('Network')}</th>
                <th scope="col" className="num">
                  {t('Confirmations')}
                </th>
                <th scope="col">{t('Typical time')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(NETWORKS).map((n) => (
                <tr key={n.id}>
                  <th scope="row">{n.name}</th>
                  <td className="num" data-label={t('Confirmations')}>
                    {n.confirmationsRequired}
                  </td>
                  <td data-label={t('Typical time')}>
                    {t(n.typicalConfirmationTime)} {t('(estimate)')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          {t(
            'Bitcoin, Ethereum and Tron follow the table in Section 5 of the Service Rules. The Rules set no count for Solana or Base; the counts shown for them are set by',
          )}{' '}
          {BRAND.name}.
        </p>
        <h2 id="payout-sent">{t('6. Receive dollars')}</h2>
        <p>
          {t(
            'Once the deposit is final and any review is complete, we send the payout. Every step is time-stamped on the status page. If something stops the exchange, the status page says what happened and what comes next.',
          )}
        </p>
        <p>
          <Link className="btn" to="/exchange">
            {t('Start an exchange')}
          </Link>
        </p>
      </WithToc>
    </>
  );
}

/* ---------------- Fees ---------------- */
/** 0.10 BTC — amount only; the rate comes from the live pricing API. */
const FEES_EXAMPLE_BTC_ATOMIC = 10_000_000n;

export function FeesPage() {
  useDocumentTitle('Fees');
  return (
    <>
      <PageHeader
        eyebrow={t('Fees')}
        title={t('One fee, shown on the quote.')}
        lead={t(
          'A 3% exchange fee on every payout method except cash by courier, where delivery cost is calculated individually for each order. There is no spread: you get the market rate. Return fees apply only if funds have to be returned.',
        )}
      />
      <WithToc
        toc={[
          ['spread', 'Exchange rate'],
          ['payout', 'Fees by method'],
          ['network', 'Network fees'],
          ['returns', 'Return fees'],
          ['limits', 'Limits'],
          ['commission', 'Commission formula'],
          ['example', 'Worked example'],
        ]}
      >
        <Notice tone="warn" title={t('Courier fee calculated per order')}>
          <p>
            {t(
              'The 3% exchange fee for bank transfer, wire and debit card is the configured schedule. Cash-by-courier delivery cost depends on the order: an operator sets it and you confirm the amount on the quote before the exchange continues. No fixed courier tariff is published.',
            )}
          </p>
        </Notice>
        <h2 id="spread">{t('Exchange rate')}</h2>
        <p>
          {t(
            'Your quote uses the market reference price at the moment of the quote, with no spread added. The fee for your method is shown as a separate line in dollars.',
          )}
        </p>
        <h2 id="payout">{t('Fees by method')}</h2>
        <div className="table-wrap" tabIndex={0} role="region" aria-label={t('Fees by method')}>
          <table className="data-table data-table--stack">
            <thead>
              <tr>
                <th scope="col">{t('Method')}</th>
                <th scope="col">{t('Fee')}</th>
                <th scope="col">{t('Estimated timing')}</th>
                <th scope="col">{t('Minimum')}</th>
              </tr>
            </thead>
            <tbody>
              {PAYOUT_ORDER.map((id) => {
                const m = PAYOUT_METHODS[id];
                const off = !m.availability.available;
                return (
                  <tr key={id}>
                    <th scope="row">{t(m.name)}</th>
                    <td data-label={t('Fee')}>{off ? t('Not offered') : t(describeFee(m.fee, m.feeStatus))}</td>
                    <td data-label={t('Timing')}>{t(m.timingEstimate)}</td>
                    <td data-label={t('Minimum')} className="tabular">
                      {off ? '—' : t('{0}, no maximum', [formatUsd(m.minCents)])}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <h2 id="network">{t('Network fees')}</h2>
        <p>
          {t(
            "Your wallet or exchange charges a network fee to send crypto. We don't receive it and it isn't part of your quote. You receive the amount on the quote as long as the full quoted amount arrives.",
          )}
        </p>
        <h2 id="returns">{t('Return fees')}</h2>
        <p>
          {t(
            'If funds have to be returned, the Service Rules allow these charges. They are not part of the quote. The full rules for returns are in the',
          )}{' '}
          <Link to="/legal/refunds">{t('refund policy')}</Link>.
        </p>
        <RulesQuote refs={['9.2', '9.7', '9.8']} />
        <h2 id="limits">{t('Limits')}</h2>
        <ul>
          <li>
            {t('Minimum sale:')} {formatUsd(PRICING_POLICY.minimumCents)} {t('in value.')}
          </li>
          <li>{t('No maximum per transaction, for every payout method.')}</li>
          <li>{t('Any order may be held for review before payout.')}</li>
        </ul>
        <h2 id="commission">{t('Commission formula')}</h2>
        <p>{t('The fee above is how the commission appears in your quote. The Service Rules define the commission as follows:')}</p>
        <RulesQuote refs={['6']} />
        <h2 id="example">{t('Worked example')}</h2>
        <p>{t('Selling 0.10 BTC at the current market rate, paid by bank transfer:')}</p>
        <LiveQuoteExample
          asset="BTC"
          network="bitcoin"
          amountAtomic={FEES_EXAMPLE_BTC_ATOMIC}
          payoutMethod="ach"
          caption={(rate) => t('Example uses the live market rate of {0}.', [rate])}
        />
      </WithToc>
    </>
  );
}

/* ---------------- Security ---------------- */
export function SecurityPage() {
  useDocumentTitle('Security');
  return (
    <>
      <PageHeader
        eyebrow={t('Security')}
        title={t('Account security and customer protection')}
        lead={t(
          'CryptoBit Exchange focuses on protecting accounts, personal data and the security of exchange operations. We apply technical and organisational measures to protect information and control exchange operations.',
        )}
      />
      <WithToc
        toc={[
          ['account', 'Your account'],
          ['data', 'Your data'],
          ['operations', 'Exchange operation security'],
          ['scams', 'How to protect yourself from fraud'],
          ['contact', 'Contact support'],
        ]}
      >
        <h2 id="account">{t('Your account')}</h2>
        <ul>
          <li>{t('Passwords are protected with strong hashing.')}</li>
          <li>{t('Sessions are protected by authentication and access-control mechanisms.')}</li>
          <li>
            {t('When two-step authentication is enabled, you can further protect sign-in to your account.')}
          </li>
          <li>{t('When you change your password, the system applies its safeguards for active sessions.')}</li>
        </ul>
        <h2 id="data">{t('Your data')}</h2>
        <ul>
          <li>{t('Access to personal data is limited according to access rights.')}</li>
          <li>{t('Payment details are handled with the protection measures in place.')}</li>
          <li>{t('Staff receive access to the information needed to process orders.')}</li>
          <li>{t('Staff actions on orders are recorded in the audit system.')}</li>
          <li>{t('We aim to minimise the collection and disclosure of confidential information.')}</li>
        </ul>
        <h2 id="operations">{t('Exchange operation security')}</h2>
        <ul>
          <li>{t('Orders follow the processing stages provided by the system.')}</li>
          <li>{t('The exchange rate and terms are fixed in accordance with the service rules.')}</li>
          <li>
            {t(
              'Crypto deposits are confirmed on the basis of transaction data received by the monitoring system when the relevant integration is available.',
            )}
          </li>
          <li>
            {t('Payouts are made after the required checks and confirmation of the applicable operation conditions.')}
          </li>
          <li>
            {t(
              'If questions arise or a situation is non-standard, an order may be sent for additional review.',
            )}
          </li>
        </ul>
        <h2 id="scams">{t('How to protect yourself from fraud')}</h2>
        <Notice
          tone="danger"
          title={t('Never send funds at the request of unknown persons posing as support staff.')}
        >
          <p>
            {t(
              'Do not share passwords, sign-in codes or account-recovery details with anyone. Do not transfer funds to “protect an account”, unlock money, or meet demands from unknown persons.',
            )}
          </p>
        </Notice>
        <ul>
          <li>{t('Do not share passwords, sign-in codes or account-recovery details with anyone.')}</li>
          <li>
            {t(
              'Do not transfer funds to “protect an account”, unlock money, or meet demands from unknown persons.',
            )}
          </li>
          <li>{t('Check the website address before signing in and creating an order.')}</li>
          <li>
            {t('If you suspect fraud, stop the operation and contact support through an official channel.')}
          </li>
        </ul>
        <h2 id="contact">{t('Contact support')}</h2>
        <p>
          {t(
            'If you have questions about an exchange, an order or account security, contact our support team.',
          )}
        </p>
        <ul>
          <li>
            <strong>{t('Telegram:')}</strong>{' '}
            <TelegramLink>{SUPPORT.telegramUrl}</TelegramLink>
          </li>
          <li>
            <strong>{t('On-site support:')}</strong>{' '}
            <Link to="/support">{t('Use the support messages section')}</Link>.
          </li>
        </ul>
        <SupportContact title={t('Need help with security?')} />
      </WithToc>
    </>
  );
}

/* ---------------- FAQ ---------------- */
export function FaqPage() {
  useDocumentTitle('FAQ');
  const groups = [...new Set(FAQ.map((f) => f.group))] as FaqItem['group'][];
  return (
    <>
      <PageHeader eyebrow="FAQ" title={t('Frequently asked questions.')} />
      <div className="container section--tight stack stack--lg" style={{ maxWidth: 'calc(860px + 2 * var(--gutter))' }}>
        {groups.map((g) => (
          <section key={g} aria-labelledby={`faq-${g}`} className="stack">
            <h2 id={`faq-${g}`} className="title">
              {t(g)}
            </h2>
            <FaqList items={FAQ.filter((f) => f.group === g)} />
          </section>
        ))}
      </div>
    </>
  );
}

/* ---------------- Help ---------------- */
export function HelpPage() {
  useDocumentTitle('Help');
  const topics: Array<{ title: string; body: string; to: string; link: string }> = [
    {
      title: 'My deposit hasn’t shown up',
      body: 'Deposits appear after the network broadcasts them, then need confirmations. Check you used the network on the status page.',
      to: '/how-it-works#deposit',
      link: 'Deposits and confirmations',
    },
    {
      title: 'I sent the wrong amount',
      body: 'A different amount puts the order on hold for review, and our team will contact you in your support messages. Clause 4.12 of the Service Rules covers recalculation and returns.',
      to: '/legal/refunds#not-completed',
      link: 'Read the refund policy',
    },
    {
      title: 'My quote expired',
      body:
        'Review quotes last ' +
        PRICING_POLICY.quoteTtlMs / 1000 +
        ' seconds. Get a new one from the review step. Nothing is submitted until you confirm.',
      to: '/exchange',
      link: 'Go to the exchange',
    },
    { title: 'Fees and limits', body: 'The full schedule, with a worked example.', to: '/fees', link: 'See fees' },
    { title: 'Account security', body: 'Two-step sign-in, sessions and scam warnings.', to: '/security', link: 'Security' },
  ];
  return (
    <>
      <PageHeader
        eyebrow={t('Help')}
        title={t('How can we help?')}
        lead={t('Answers to common problems, and a direct line to our support team.')}
      />
      <section className="section--tight">
        <div className="container">
          <ul className="pillars" style={{ rowGap: 48 }}>
            {topics.map((topic) => (
              <li key={t(topic.title)}>
                <h2 className="title">{t(topic.title)}</h2>
                <p>{t(topic.body)}</p>
                <p>
                  <Link to={topic.to}>
                    {t(topic.link)} <span aria-hidden="true">→</span>
                  </Link>
                </p>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 64, maxWidth: 720 }}>
            <SupportContact title={t('Contacting support')}>
              {t('Message us on Telegram, or, signed in,')} <Link to="/support">{t('send us a message')}</Link>{' '}
              {t(
                "and link it to an order if it's about one; replies appear in your account. Never share your password, codes, private keys or seed phrase with anyone, including us.",
              )}
            </SupportContact>
          </div>
        </div>
      </section>
    </>
  );
}

/* ---------------- 404 ---------------- */
export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="container flow stack" style={{ maxWidth: 'calc(680px + 2 * var(--gutter))' }}>
      <p className="eyebrow">404</p>
      <h1 className="display-l">{t("We couldn't find that page.")}</h1>
      <p>{t('The link may be out of date.')}</p>
      <div className="row">
        <Link className="btn" to="/">
          {t('Go home')}
        </Link>
        <Link className="btn btn--secondary" to="/help">
          {t('Help')}
        </Link>
      </div>
    </div>
  );
}
