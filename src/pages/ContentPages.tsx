import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { MockBadge, Notice, PageHeader } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { BRAND } from '@/config/brand';
import { FAQ, FaqList, type FaqItem } from '@/content/faq';
import { NETWORKS } from '@/domain/assets';
import { formatBps, formatUsd } from '@/domain/money';
import { describeFee, PAYOUT_METHODS, PAYOUT_ORDER } from '@/domain/payout';
import { PRICING_POLICY } from '@/domain/quote';

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
          Send exactly the amount shown to the deposit address shown, on the network shown. We wait for a set number of network
          confirmations, then screen the transaction.
        </p>
        <div className="table-wrap">
          <table className="data-table data-table--stack">
            <caption>
              Confirmation policy <MockBadge label="Mock policy" />
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
export function FeesPage() {
  useDocumentTitle('Fees');
  const vol = PRICING_POLICY.spreadBps.volatile;
  const stb = PRICING_POLICY.spreadBps.stable;
  return (
    <>
      <PageHeader
        eyebrow="Fees"
        title="Two charges, both on the quote."
        lead="An exchange spread and a payout fee. Both appear as separate lines, in dollars, before you confirm."
      >
        <div className="row">
          <MockBadge label="Mock fee schedule" />
        </div>
      </PageHeader>
      <WithToc
        toc={[
          ['spread', 'Exchange spread'],
          ['payout', 'Payout fees'],
          ['network', 'Network fees'],
          ['limits', 'Limits'],
          ['example', 'Worked example'],
        ]}
      >
        <Notice tone="warn" title="Preview schedule">
          <p>These values are placeholders for the preview. A live fee schedule would be set and approved before launch.</p>
        </Notice>
        <h2 id="spread">Exchange spread</h2>
        <p>
          The spread is a percentage of the value of your crypto at the reference price. It is smaller for larger amounts and for
          stablecoins.
        </p>
        <div className="table-wrap">
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
                <th scope="row">Under {formatUsd(vol[0].upToCents!).replace('.00', '')}</th>
                <td className="num">{formatBps(vol[0].bps)}</td>
                <td className="num">{formatBps(stb[0].bps)}</td>
              </tr>
              <tr>
                <th scope="row">
                  {formatUsd(vol[0].upToCents!).replace('.00', '')} to {formatUsd(PRICING_POLICY.retailMaximumCents).replace('.00', '')}
                </th>
                <td className="num">{formatBps(vol[1].bps)}</td>
                <td className="num">{formatBps(stb[1].bps)}</td>
              </tr>
              <tr>
                <th scope="row">Large-transaction desk</th>
                <td className="num">Quoted per request</td>
                <td className="num">Quoted per request</td>
              </tr>
            </tbody>
          </table>
        </div>
        <h2 id="payout">Payout fees</h2>
        <div className="table-wrap">
          <table className="data-table data-table--stack">
            <thead>
              <tr>
                <th scope="col">Method</th>
                <th scope="col">Fee</th>
                <th scope="col">Estimated timing</th>
                <th scope="col">Per transaction</th>
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
                    <td data-label="Limits" className="tabular">
                      {off ? '—' : `${formatUsd(m.minCents)} – ${formatUsd(m.maxCents)}`}
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
        <h2 id="limits">Limits</h2>
        <ul>
          <li>Minimum sale: {formatUsd(PRICING_POLICY.minimumCents)} in value.</li>
          <li>
            Online maximum: {formatUsd(PRICING_POLICY.retailMaximumCents)} per transaction. Above that, use the{' '}
            <Link to="/large-transactions">large-transaction desk</Link>.
          </li>
        </ul>
        <h2 id="example">Worked example</h2>
        <p>Selling 0.10 BTC at an illustrative reference price of $68,000.00, paid by bank transfer:</p>
        <dl className="dl">
          <div>
            <dt>Value at reference price</dt>
            <dd className="tabular">$6,800.00</dd>
          </div>
          <div>
            <dt>Spread ({formatBps(vol[0].bps)})</dt>
            <dd className="tabular">−$68.00</dd>
          </div>
          <div>
            <dt>Payout fee (ACH)</dt>
            <dd className="tabular">$0.00</dd>
          </div>
          <div>
            <dt>
              <strong>You receive</strong>
            </dt>
            <dd className="tabular">
              <strong>$6,732.00</strong>
            </dd>
          </div>
        </dl>
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
        eyebrow="Security"
        title="How the product protects you."
        lead="What is designed in, what is simulated in this preview, and how to protect yourself from scams."
      />
      <WithToc
        toc={[
          ['preview-status', 'Preview status'],
          ['account', 'Your account'],
          ['data', 'Your data'],
          ['transactions', 'Transactions'],
          ['scams', 'Scams'],
          ['report', 'Report an issue'],
        ]}
      >
        <h2 id="preview-status">Preview status</h2>
        <Notice tone="warn" title="Controls in this preview are simulated">
          <p>
            No identity provider, screening provider, custodian or bank is connected. The descriptions below explain how the product is
            designed, not what a live service guarantees.
          </p>
        </Notice>
        <h2 id="account">Your account</h2>
        <ul>
          <li>Two-step sign-in on every new session.</li>
          <li>Sessions expire automatically after 12 hours.</li>
          <li>Payout destinations are stored as the last four digits only. Card numbers are never collected by this site.</li>
        </ul>
        <h2 id="data">Your data</h2>
        <ul>
          <li>The preview keeps data only in your browser's local storage. Clearing site data removes it.</li>
          <li>No analytics, advertising or third-party scripts are loaded. Fonts are served from this site.</li>
        </ul>
        <h2 id="transactions">Transactions</h2>
        <ul>
          <li>Each exchange moves through a fixed sequence of states. A payout can't be sent before the deposit is final.</li>
          <li>Quotes are re-checked against their inputs when you confirm, and expired quotes are refused.</li>
          <li>Refund addresses are screened before an exchange is accepted (simulated here).</li>
        </ul>
        <h2 id="scams">Protect yourself from scams</h2>
        <Notice tone="danger" title="We will never ask you to send crypto">
          <p>
            Nobody from {BRAND.name} will call, text, or message you asking you to buy or send crypto, move money to "protect" it, or share
            a sign-in code. Government agencies and banks don't ask for that either.
          </p>
        </Notice>
        <ul>
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
          A live service would publish a vulnerability disclosure policy and a dedicated contact here. The preview contact,{' '}
          <span className="mono">{BRAND.supportEmail}</span>, is a placeholder and is not monitored.
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
            <h2 id={`faq-${g}`} style={{ fontSize: 'var(--fs-title)' }}>
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
      body: 'A different amount needs a new quote. On a live service, support would offer a re-quote or a refund to your refund address.',
      to: '/faq',
      link: 'Read the FAQ',
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
    {
      title: 'Large amounts',
      body: `Selling ${formatUsd(PRICING_POLICY.retailMaximumCents)} or more goes through the desk.`,
      to: '/large-transactions',
      link: 'Large transactions',
    },
    { title: 'Account security', body: 'Two-step sign-in, sessions and scam warnings.', to: '/security', link: 'Security' },
  ];
  return (
    <>
      <PageHeader
        eyebrow="Help"
        title="How can we help?"
        lead="Answers to common problems. Live support isn't available in this preview."
      />
      <section className="section--tight">
        <div className="container">
          <ul className="pillars" style={{ rowGap: 48 }}>
            {topics.map((t) => (
              <li key={t.title}>
                <h2 style={{ fontSize: 'var(--fs-title)' }}>{t.title}</h2>
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
            <Notice tone="neutral" title="Contacting support">
              <p>
                A live service would offer secure in-account messaging. The address <span className="mono">{BRAND.supportEmail}</span> is a
                placeholder and is not monitored. Never share your password, codes, private keys or seed phrase with anyone.
              </p>
            </Notice>
          </div>
        </div>
      </section>
    </>
  );
}

/* ---------------- Legal ---------------- */
export function LegalPage() {
  useDocumentTitle('Legal');
  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Legal information."
        lead="Plain-language disclosures for this preview. They are drafts, not legal advice, and must be replaced by counsel-approved documents before any launch."
      />
      <WithToc
        toc={[
          ['preview', 'Preview disclosure'],
          ['licensing', 'Licensing status'],
          ['risk', 'Risk disclosures'],
          ['privacy', 'Privacy'],
          ['terms', 'Terms of use'],
        ]}
      >
        <h2 id="preview">Preview disclosure</h2>
        <p>
          This website is a product preview. Prices, quotes, fees, identity verification, screening results, deposit addresses,
          transactions, receipts and payout references are <strong>simulated</strong>. No cryptocurrency or US dollars can be sent,
          received, held or exchanged through it. Deposit addresses are deliberately invalid placeholders.
        </p>
        <h2 id="licensing">Licensing and regulatory status</h2>
        <dl className="dl">
          <div>
            <dt>Operating entity</dt>
            <dd>{BRAND.legalEntity ?? 'None formed or verified'}</dd>
          </div>
          <div>
            <dt>FinCEN MSB registration</dt>
            <dd>None</dd>
          </div>
          <div>
            <dt>State money transmitter licenses</dt>
            <dd>None</dd>
          </div>
          <div>
            <dt>NMLS ID</dt>
            <dd>None</dd>
          </div>
          <div>
            <dt>Banking or payout partners</dt>
            <dd>None</dd>
          </div>
        </dl>
        <p>
          {BRAND.name} is not a bank. Nothing here is FDIC- or SIPC-insured, and no insurance of any kind is offered. No relationship with
          any bank, payment network, custodian or courier exists. Real-money operation would require, at minimum, FinCEN registration, state
          licensing where required, an anti-money-laundering program, sanctions screening and contracted providers.
        </p>
        <h2 id="risk">Risk disclosures</h2>
        <ul>
          <li>Crypto assets are not legal tender and are not backed by any government.</li>
          <li>Crypto assets are not protected by FDIC or SIPC insurance.</li>
          <li>Prices can change rapidly and you may lose value between quoting and settlement, within the limits of a locked quote.</li>
          <li>Blockchain transactions generally cannot be reversed. Funds sent to the wrong address or network may be lost permanently.</li>
          <li>Stablecoins can lose their peg to the US dollar.</li>
          <li>Payout timing depends on networks, reviews and banks, and is never guaranteed.</li>
          <li>Scammers use crypto because it is hard to reverse. Never send crypto at someone else's direction.</li>
        </ul>
        <h2 id="privacy">Privacy</h2>
        <p>
          The preview stores what you enter (name, email, payout destination nicknames and the last four digits, refund addresses and
          simulated transactions) in your browser's local storage on this device only. Nothing is sent to a server. Passwords are not
          stored. No cookies, analytics or third-party trackers are used. Clear this site's data in your browser to remove everything.
        </p>
        <h2 id="terms">Terms of use (preview)</h2>
        <ol>
          <li>The preview is provided for demonstration and evaluation only, without warranty.</li>
          <li>Nothing on the site is an offer, solicitation or recommendation to buy or sell any asset.</li>
          <li>Don't enter real bank details, identity documents, private keys or seed phrases.</li>
          <li>Simulated figures must not be relied on for any financial decision.</li>
        </ol>
      </WithToc>
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
