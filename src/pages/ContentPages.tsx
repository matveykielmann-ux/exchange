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

function WithToc({ toc, children }: { toc: Array<[string, string]>; children: ReactNode }) {
  return (
    <div className="container content-grid">
      <nav className="toc" aria-label="On this page">
        <p className="eyebrow">On this page</p>
        {toc.map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
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
        eyebrow="How it works"
        title="From crypto to dollars, step by step."
        lead="One quote, one confirmation and one status page cover the whole exchange."
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
        <h2 id="quote">1. Get a quote</h2>
        <p>
          Choose the asset and the network you'll send on, then enter an amount. You see the reference price, the value of your crypto, our
          spread and the payout fee, all before you share any personal details.
        </p>
        <h2 id="payout">2. Choose a payout method</h2>
        <p>
          Bank transfer (ACH), domestic wire, or debit card. Each shows its fee and estimated timing. Methods that can't take your amount
          are shown and explained, not hidden.
        </p>
        <h2 id="details">3. Add your details</h2>
        <p>
          Sign in, choose or add the account that will receive dollars, and give a refund address on the same network in case the exchange
          can't be completed.
        </p>
        <h2 id="confirm">4. Review and confirm</h2>
        <p>
          We lock a quote for {PRICING_POLICY.quoteTtlMs / 1000} seconds while you review it. Your identity must be verified first. When you
          confirm, the rate holds for deposits that arrive within {PRICING_POLICY.depositWindowMs / 60000} minutes.
        </p>
        <h2 id="deposit">5. Send your crypto</h2>
        <p>
          Send exactly the amount shown to the deposit address shown, on the network shown. We wait for the required number of network
          confirmations, then screen the transaction. Clause 4.22 of the <Link to="/legal/terms#clause-4-22">Service Rules</Link> asks you
          to provide confirmation of the transfer: a screenshot showing the time, the wallet address, the amount and the TXID or blockchain
          link. You can give the transaction hash on the order page.
        </p>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Deposit steps">
          <table className="data-table data-table--stack">
            <caption>
              Required confirmations <MockBadge label="Sandbox policy" />
            </caption>
            <thead>
              <tr>
                <th scope="col">Network</th>
                <th scope="col" className="num">
                  Confirmations
                </th>
                <th scope="col">Typical time</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(NETWORKS).map((n) => (
                <tr key={n.id}>
                  <th scope="row">{n.name}</th>
                  <td className="num" data-label="Confirmations">
                    {n.confirmationsRequired}
                  </td>
                  <td data-label="Typical time">{n.typicalConfirmationTime} (estimate)</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          Bitcoin, Ethereum and Tron follow the table in Section 5 of the Service Rules. The Rules set no count for Solana or Base; the
          counts shown for them are set by {BRAND.name}.
        </p>
        <h2 id="payout-sent">6. Receive dollars</h2>
        <p>
          Once the deposit is final and any review is complete, we send the payout. Every step is time-stamped on the status page. If
          something stops the exchange, the status page says what happened and what comes next.
        </p>
        <p>
          <Link className="btn" to="/exchange">
            Start an exchange
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
        eyebrow="Fees"
        title="Two charges, both on the quote."
        lead="An exchange spread and a payout fee. Both appear as separate lines, in dollars, before you confirm. Return fees apply only if funds have to be returned."
      >
        <div className="row">
          <MockBadge label="Sandbox fee schedule" />
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
        <Notice tone="warn" title="Draft schedule">
          <p>
            These values are the current draft schedule and will be confirmed before launch. Whatever applies to your sale is shown on the
            quote, line by line, before you confirm.
          </p>
        </Notice>
        <h2 id="spread">Exchange spread</h2>
        <p>
          The spread is a percentage of the value of your crypto at the reference price. It is smaller for larger amounts and for
          stablecoins.
        </p>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Spread schedule">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Value of the sale</th>
                <th scope="col" className="num">
                  BTC, ETH
                </th>
                <th scope="col" className="num">
                  USDT, USDC
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Under {formatUsd(vol[0].upToCents!, { whole: true })}</th>
                <td className="num">{formatBps(vol[0].bps)}</td>
                <td className="num">{formatBps(stb[0].bps)}</td>
              </tr>
              <tr>
                <th scope="row">{formatUsd(vol[0].upToCents!, { whole: true })} and over</th>
                <td className="num">{formatBps(vol[1].bps)}</td>
                <td className="num">{formatBps(stb[1].bps)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <h2 id="payout">Payout fees</h2>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Payout fees">
          <table className="data-table data-table--stack">
            <thead>
              <tr>
                <th scope="col">Method</th>
                <th scope="col">Fee</th>
                <th scope="col">Estimated timing</th>
                <th scope="col">Minimum</th>
              </tr>
            </thead>
            <tbody>
              {PAYOUT_ORDER.map((id) => {
                const m = PAYOUT_METHODS[id];
                const off = !m.availability.available;
                return (
                  <tr key={id}>
                    <th scope="row">{m.name}</th>
                    <td data-label="Fee">{off ? 'Not offered' : describeFee(m.fee)}</td>
                    <td data-label="Timing">{m.timingEstimate}</td>
                    <td data-label="Minimum" className="tabular">
                      {off ? '—' : `${formatUsd(m.minCents)}, no maximum`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <h2 id="network">Network fees</h2>
        <p>
          Your wallet or exchange charges a network fee to send crypto. We don't receive it and it isn't part of your quote. You receive the
          amount on the quote as long as the full quoted amount arrives.
        </p>
        <h2 id="returns">Return fees</h2>
        <p>
          If funds have to be returned, the Service Rules allow these charges. They are not part of the quote. The full rules for returns
          are in the <Link to="/legal/refunds">refund policy</Link>.
        </p>
        <RulesQuote refs={['9.2', '9.7', '9.8']} />
        <h2 id="limits">Limits</h2>
        <ul>
          <li>Minimum sale: {formatUsd(PRICING_POLICY.minimumCents)} in value.</li>
          <li>No maximum per transaction, for every payout method.</li>
          <li>Any order may be held for review before payout.</li>
        </ul>
        <h2 id="commission">Commission formula</h2>
        <p>
          The spread and payout fee above are how the commission appears in your quote. The Service Rules define the commission as follows:
        </p>
        <RulesQuote refs={['6']} />
        <h2 id="example">Worked example</h2>
        <p>
          Selling 0.10 BTC at an illustrative reference price of {formatUsd(FEES_EXAMPLE.referencePriceMicros / 10_000n)}, paid by bank
          transfer:
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
      <Notice tone="warn" title="This is the sandbox">
        <p>
          Identity verification, screening, deposits and payouts are simulated by test providers. The controls below run for real on the
          server; the outcomes they act on are simulated.
        </p>
      </Notice>
    );
  const missing = config.providers.filter((p) => p.state !== 'configured');
  return (
    <Notice tone={missing.length ? 'warn' : 'info'} title={missing.length ? 'Some providers are not connected yet' : 'Providers connected'}>
      {missing.length ? (
        <p>Not yet connected: {missing.map((p) => p.label).join(', ')}. Orders that need them can't be placed until they are.</p>
      ) : (
        <p>Every provider this service relies on is configured.</p>
      )}
    </Notice>
  );
}

export function SecurityPage() {
  useDocumentTitle('Security');
  return (
    <>
      <PageHeader
        eyebrow="Security"
        title="How the product protects you."
        lead="How accounts, data and transactions are protected, what is still being set up, and how to protect yourself from scams."
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
        <h2 id="status">Current status</h2>
        <SecurityStatus />
        <h2 id="account">Your account</h2>
        <ul>
          <li>Passwords are stored only as salted, slow hashes. Repeated failed sign-ins lock the account for a short time.</li>
          <li>Sessions are held on our server and referenced by a secure, HTTP-only cookie. They expire after 12 hours.</li>
          <li>
            You can add an authenticator app for two-step sign-in, see your active sessions and sign out the others from your account.
          </li>
          <li>Changing your password signs out every other session.</li>
        </ul>
        <h2 id="data">Your data</h2>
        <ul>
          <li>Bank account details are encrypted in our database and shown back only as the last four digits.</li>
          <li>Card numbers are never typed into this site, and security codes (CVV) are never collected or stored.</li>
          <li>Staff see masked contact details by default, and every staff action on an order is recorded in an append-only audit log.</li>
          <li>No analytics, advertising or third-party scripts are loaded. Fonts are served from this site.</li>
        </ul>
        <h2 id="transactions">Transactions</h2>
        <ul>
          <li>Each exchange moves through a fixed sequence of states. A payout can't be sent before the deposit is final.</li>
          <li>Quotes are stored when issued, can be used once, and are refused after they expire.</li>
          <li>A deposit counts only when our blockchain monitoring reports it. Saying "I sent it" doesn't move an order forward.</li>
          <li>Refund addresses are screened before an exchange is accepted.</li>
          <li>
            Payouts above the review threshold, or with any exception, need a person on our team to approve them, with a recorded reason.
          </li>
        </ul>
        <h2 id="scams">Protect yourself from scams</h2>
        <Notice tone="danger" title="We will never ask you to send crypto">
          <p>
            Nobody from {BRAND.name} will call, text, or message you asking you to buy or send crypto, move money to "protect" it, or share
            a sign-in code. Government agencies and banks don't ask for that either.
          </p>
        </Notice>
        <ul>
          <li>
            Only contacts listed on this website are official (clause 4.21 of the <Link to="/legal/terms#clause-4-21">Service Rules</Link>
            ).
          </li>
          <li>Be wary of anyone who contacts you first and creates urgency.</li>
          <li>Don't send crypto to pay a debt, a fine, a "security fee" or for a romance or investment opportunity.</li>
          <li>
            If you think you've been targeted, stop, contact your bank, and report it at{' '}
            <a href="https://reportfraud.ftc.gov/" rel="noopener noreferrer" target="_blank">
              reportfraud.ftc.gov <Icon name="external" width={14} height={14} style={{ display: 'inline', verticalAlign: '-2px' }} />
              <span className="visually-hidden">(opens in a new tab)</span>
            </a>{' '}
            or{' '}
            <a href="https://www.ic3.gov/" rel="noopener noreferrer" target="_blank">
              ic3.gov <Icon name="external" width={14} height={14} style={{ display: 'inline', verticalAlign: '-2px' }} />
              <span className="visually-hidden">(opens in a new tab)</span>
            </a>
            .
          </li>
        </ul>
        <h2 id="report">Report a security issue</h2>
        <p>
          Send details to <span className="mono">{BRAND.supportEmail}</span> or through <Link to="/support">support messages</Link>. A
          vulnerability disclosure policy will be published here before launch.
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
      <PageHeader eyebrow="FAQ" title="Frequently asked questions." />
      <div className="container section--tight stack stack--lg" style={{ maxWidth: 'calc(860px + 2 * var(--gutter))' }}>
        {groups.map((g) => (
          <section key={g} aria-labelledby={`faq-${g}`} className="stack">
            <h2 id={`faq-${g}`} className="title">
              {g}
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
      <PageHeader eyebrow="Help" title="How can we help?" lead="Answers to common problems, and a direct line to our support team." />
      <section className="section--tight">
        <div className="container">
          <ul className="pillars" style={{ rowGap: 48 }}>
            {topics.map((t) => (
              <li key={t.title}>
                <h2 className="title">{t.title}</h2>
                <p>{t.body}</p>
                <p>
                  <Link to={t.to}>
                    {t.link} <span aria-hidden="true">→</span>
                  </Link>
                </p>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 64, maxWidth: 720 }}>
            <SupportContact title="Contacting support">
              Message us on Telegram, or, signed in, <Link to="/support">send us a message</Link> and link it to an order if it's about one;
              replies appear in your account. You can also write to <span className="mono">{BRAND.supportEmail}</span>. Never share your
              password, codes, private keys or seed phrase with anyone, including us.
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
      <h1 className="display-l">We couldn't find that page.</h1>
      <p>The link may be out of date.</p>
      <div className="row">
        <Link className="btn" to="/">
          Go home
        </Link>
        <Link className="btn btn--secondary" to="/help">
          Help
        </Link>
      </div>
    </div>
  );
}
