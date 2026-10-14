import { SupportContact } from '@/components/SupportContact';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { MockBadge, Notice, PageHeader } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useConfig } from '@/state/config';
import { BRAND } from '@/config/brand';
import { FAQ, FaqList, type FaqItem } from '@/content/faq';
import { NETWORKS } from '@/domain/assets';
import { formatBps, formatUsd } from '@/domain/money';
import { describeFee, PAYOUT_METHODS, PAYOUT_ORDER } from '@/domain/payout';
import { calculateQuote, PRICING_POLICY } from '@/domain/quote';
import { QuoteBreakdown } from '@/components/QuoteBreakdown';
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
            "Choose the asset and the network you'll send on, then enter an amount. You see the exchange rate, the value of your crypto at that rate and the payout fee, all before you share any personal details.",
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
            "Sign in, choose or add the account that will receive dollars, and give a refund address on the same network in case the exchange can't be completed.",
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
            <caption>
              {t('Required confirmations')} <MockBadge label={t('Sandbox policy')} />
            </caption>
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
/** Computed with the live formula so the example can never drift from the fee schedule. */
const FEES_EXAMPLE = calculateQuote({
  asset: 'BTC',
  network: 'bitcoin',
  amountAtomic: 10_000_000n, // 0.10 BTC
  payoutMethod: 'ach',
  referencePriceMicros: 68_000_000_000n, // $68,000.00 — illustrative
  now: 0,
}).quote;

export function FeesPage() {
  useDocumentTitle('Fees');
  const vol = PRICING_POLICY.spreadBps.volatile;
  const stb = PRICING_POLICY.spreadBps.stable;
  return (
    <>
      <PageHeader
        eyebrow={t('Fees')}
        title={t('Two charges, both on the quote.')}
        lead={t(
          'An exchange spread and a payout fee. Both appear as separate lines, in dollars, before you confirm. Return fees apply only if funds have to be returned.',
        )}
      >
        <div className="row">
          <MockBadge label={t('Sandbox fee schedule')} />
        </div>
      </PageHeader>
      <WithToc
        toc={[
          ['spread', 'Exchange spread'],
          ['payout', 'Payout fees'],
          ['network', 'Network fees'],
          ['returns', 'Return fees'],
          ['limits', 'Limits'],
          ['commission', 'Commission formula'],
          ['example', 'Worked example'],
        ]}
      >
        <Notice tone="warn" title={t('Draft schedule')}>
          <p>
            {t(
              'These values are the current draft schedule and will be confirmed before launch. Whatever applies to your sale is shown on the quote, line by line, before you confirm.',
            )}
          </p>
        </Notice>
        <h2 id="spread">{t('Exchange spread')}</h2>
        <p>
          {t(
            'The spread is a percentage of the value of your crypto at the reference price. It is smaller for larger amounts and for stablecoins.',
          )}
        </p>
        <div className="table-wrap" tabIndex={0} role="region" aria-label={t('Spread schedule')}>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{t('Value of the sale')}</th>
                <th scope="col" className="num">
                  {t('BTC, ETH')}
                </th>
                <th scope="col" className="num">
                  {t('USDT, USDC')}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">
                  {t('Under')} {formatUsd(vol[0].upToCents!, { whole: true })}
                </th>
                <td className="num">{formatBps(vol[0].bps)}</td>
                <td className="num">{formatBps(stb[0].bps)}</td>
              </tr>
              <tr>
                <th scope="row">
                  {formatUsd(vol[0].upToCents!, { whole: true })} {t('and over')}
                </th>
                <td className="num">{formatBps(vol[1].bps)}</td>
                <td className="num">{formatBps(stb[1].bps)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <h2 id="payout">{t('Payout fees')}</h2>
        <div className="table-wrap" tabIndex={0} role="region" aria-label={t('Payout fees')}>
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
                    <td data-label={t('Fee')}>{off ? t('Not offered') : t(describeFee(m.fee))}</td>
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
        <p>
          {t(
            'The spread and payout fee above are how the commission appears in your quote. The Service Rules define the commission as follows:',
          )}
        </p>
        <RulesQuote refs={['6']} />
        <h2 id="example">{t('Worked example')}</h2>
        <p>
          {t('Selling 0.10 BTC at an illustrative reference price of')} {formatUsd(FEES_EXAMPLE.referencePriceMicros / 10_000n)}
          {t(', paid by bank transfer:')}
        </p>
        <div className="panel">
          <div className="panel__body">
            <QuoteBreakdown quote={FEES_EXAMPLE} />
          </div>
        </div>
      </WithToc>
    </>
  );
}

/* ---------------- Security ---------------- */
function SecurityStatus() {
  const config = useConfig();
  if (config.mode === 'sandbox')
    return (
      <Notice tone="warn" title={t('This is the sandbox')}>
        <p>
          {t(
            'Identity verification, screening, deposits and payouts are simulated by test providers. The controls below run for real on the server; the outcomes they act on are simulated.',
          )}
        </p>
      </Notice>
    );
  const missing = config.providers.filter((p) => p.state !== 'configured');
  return (
    <Notice
      tone={missing.length ? 'warn' : 'info'}
      title={missing.length ? t('Some providers are not connected yet') : t('Providers connected')}
    >
      {missing.length ? (
        <p>
          {t('Not yet connected:')} {missing.map((p) => p.label).join(', ')}
          {t(". Orders that need them can't be placed until they are.")}
        </p>
      ) : (
        <p>{t('Every provider this service relies on is configured.')}</p>
      )}
    </Notice>
  );
}

export function SecurityPage() {
  useDocumentTitle('Security');
  return (
    <>
      <PageHeader
        eyebrow={t('Security')}
        title={t('How the product protects you.')}
        lead={t('How accounts, data and transactions are protected, what is still being set up, and how to protect yourself from scams.')}
      />
      <WithToc
        toc={[
          ['status', 'Current status'],
          ['account', 'Your account'],
          ['data', 'Your data'],
          ['transactions', 'Transactions'],
          ['scams', 'Scams'],
          ['report', 'Report an issue'],
        ]}
      >
        <h2 id="status">{t('Current status')}</h2>
        <SecurityStatus />
        <h2 id="account">{t('Your account')}</h2>
        <ul>
          <li>{t('Passwords are stored only as salted, slow hashes. Repeated failed sign-ins lock the account for a short time.')}</li>
          <li>{t('Sessions are held on our server and referenced by a secure, HTTP-only cookie. They expire after 12 hours.')}</li>
          <li>
            {t(
              'You can add an authenticator app for two-step sign-in, see your active sessions and sign out the others from your account.',
            )}
          </li>
          <li>{t('Changing your password signs out every other session.')}</li>
        </ul>
        <h2 id="data">{t('Your data')}</h2>
        <ul>
          <li>{t('Bank account details are encrypted in our database and shown back only as the last four digits.')}</li>
          <li>{t('Card numbers are never typed into this site, and security codes (CVV) are never collected or stored.')}</li>
          <li>
            {t('Staff see masked contact details by default, and every staff action on an order is recorded in an append-only audit log.')}
          </li>
          <li>{t('No analytics, advertising or third-party scripts are loaded. Fonts are served from this site.')}</li>
        </ul>
        <h2 id="transactions">{t('Transactions')}</h2>
        <ul>
          <li>{t("Each exchange moves through a fixed sequence of states. A payout can't be sent before the deposit is final.")}</li>
          <li>{t('Quotes are stored when issued, can be used once, and are refused after they expire.')}</li>
          <li>
            {t('A deposit counts only when our blockchain monitoring reports it. Saying "I sent it" doesn\'t move an order forward.')}
          </li>
          <li>{t('Refund addresses are screened before an exchange is accepted.')}</li>
          <li>
            {t(
              'Payouts above the review threshold, or with any exception, need a person on our team to approve them, with a recorded reason.',
            )}
          </li>
        </ul>
        <h2 id="scams">{t('Protect yourself from scams')}</h2>
        <Notice tone="danger" title={t('We will never ask you to send crypto')}>
          <p>
            {t('Nobody from')} {BRAND.name}{' '}
            {t(
              'will call, text, or message you asking you to buy or send crypto, move money to "protect" it, or share a sign-in code. Government agencies and banks don\'t ask for that either.',
            )}
          </p>
        </Notice>
        <ul>
          <li>
            {t('Only contacts listed on this website are official (clause 4.21 of the')}{' '}
            <Link to="/legal/terms#clause-4-21">{t('Service Rules')}</Link>
            ).
          </li>
          <li>{t('Be wary of anyone who contacts you first and creates urgency.')}</li>
          <li>{t('Don\'t send crypto to pay a debt, a fine, a "security fee" or for a romance or investment opportunity.')}</li>
          <li>
            {t("If you think you've been targeted, stop, contact your bank, and report it at")}{' '}
            <a href="https://reportfraud.ftc.gov/" rel="noopener noreferrer" target="_blank">
              {t('reportfraud.ftc.gov')}{' '}
              <Icon name="external" width={14} height={14} style={{ display: 'inline', verticalAlign: '-2px' }} />
              <span className="visually-hidden">{t('(opens in a new tab)')}</span>
            </a>{' '}
            {t('or')}{' '}
            <a href="https://www.ic3.gov/" rel="noopener noreferrer" target="_blank">
              {t('ic3.gov')} <Icon name="external" width={14} height={14} style={{ display: 'inline', verticalAlign: '-2px' }} />
              <span className="visually-hidden">{t('(opens in a new tab)')}</span>
            </a>
            .
          </li>
        </ul>
        <h2 id="report">{t('Report a security issue')}</h2>
        <p>
          {t('Send details to')} <span className="mono">{BRAND.supportEmail}</span> {t('or through')}{' '}
          <Link to="/support">{t('support messages')}</Link>
          {t('. A vulnerability disclosure policy will be published here before launch.')}
        </p>
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
              {t("and link it to an order if it's about one; replies appear in your account. You can also write to")}{' '}
              <span className="mono">{BRAND.supportEmail}</span>
              {t('. Never share your password, codes, private keys or seed phrase with anyone, including us.')}
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
