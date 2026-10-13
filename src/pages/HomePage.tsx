import { Link } from 'react-router-dom';
import { Calculator } from '@/components/Calculator';
import { HeroArt } from '@/components/HeroArt';
import { Icon } from '@/components/Icon';
import { QuoteBreakdown } from '@/components/QuoteBreakdown';
import { AssetMark, MockBadge } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { FAQ, FaqList } from '@/content/faq';
import { ASSET_ORDER, ASSETS, NETWORKS, networkLabel } from '@/domain/assets';
import { formatUsd } from '@/domain/money';
import { describeFee, PAYOUT_METHODS, PAYOUT_ORDER } from '@/domain/payout';
import { calculateQuote, PRICING_POLICY } from '@/domain/quote';

/** A fixed, computed example so the anatomy section never drifts from the real formula. */
const EXAMPLE = calculateQuote({
  asset: 'ETH',
  network: 'ethereum',
  amountAtomic: 1_500_000_000_000_000_000n, // 1.5 ETH
  payoutMethod: 'ach',
  referencePriceMicros: 3_400_000_000n, // $3,400.00 — illustrative
  now: 0,
}).quote;

const STEPS = [
  { title: 'Get a quote', body: 'Pick the asset and network, enter an amount, and see the full breakdown before anything else.' },
  { title: 'Choose your payout', body: 'Bank transfer, wire or debit card. Each option shows its fee and estimated timing.' },
  { title: 'Send your crypto', body: 'Confirm, then send to the deposit address shown, on the network shown, before the window closes.' },
  { title: 'Receive dollars', body: 'Track confirmations and your payout on one status page. Every step is time-stamped.' },
];

export function HomePage() {
  useDocumentTitle('');
  return (
    <>
      <section className="hero">
        <div className="container hero__grid">
          <div className="hero__copy">
            <p className="hero-pill">
              <span className="hero-pill__dot" aria-hidden="true" />
              Crypto to US dollars
            </p>
            <h1 className="display-xl hero__title">
              Sell crypto.
              <br />
              Get dollars.
              <br />
              <em>Every fee shown.</em>
              <br />
              <em>Before you confirm.</em>
            </h1>
            <p className="lead">
              Send BTC, ETH, USDT or USDC and receive US dollars in your bank account, with the reference price, our spread and the payout
              fee listed as separate lines.
            </p>
            <div className="row hero__ctas">
              <Link className="btn btn--lg" to="/exchange">
                Start an exchange <Icon name="arrowUpRight" width={18} height={18} />
              </Link>
              <Link className="btn btn--lg btn--secondary" to="/how-it-works">
                <span className="play-dot" aria-hidden="true">
                  <Icon name="play" width={14} height={14} />
                </span>
                How it works
              </Link>
            </div>
          </div>
          <div className="hero__art">
            <HeroArt />
          </div>
        </div>
        <div className="container">
          <ul className="stat-row" aria-label="At a glance">
            <li className="stat">
              <span className="stat__icon">
                <Icon name="layers" />
              </span>
              <span>
                <strong>{ASSET_ORDER.length} assets</strong>
                <span>{ASSET_ORDER.join(', ')}</span>
              </span>
            </li>
            <li className="stat">
              <span className="stat__icon">
                <Icon name="globe" />
              </span>
              <span>
                <strong>{Object.keys(NETWORKS).length} networks</strong>
                <span>Chosen together with the asset</span>
              </span>
            </li>
            <li className="stat">
              <span className="stat__icon">
                <Icon name="lock" />
              </span>
              <span>
                <strong>{formatUsd(PRICING_POLICY.retailMaximumCents, { whole: true })}</strong>
                <span>Per online exchange</span>
              </span>
            </li>
            <li className="stat">
              <span className="stat__icon">
                <Icon name="bank" />
              </span>
              <span>
                <strong>$0 ACH fee</strong>
                <span>{PAYOUT_METHODS.ach.timingEstimate}</span>
              </span>
            </li>
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="quote-title">
        <div className="container quote-band">
          <div className="section-head">
            <p className="eyebrow">Get a quote</p>
            <h2 id="quote-title" className="display-m">
              See exactly what you will receive.
            </h2>
            <ul className="check-list">
              <li>
                <Icon name="check" /> One quote and one status page, from deposit to payout
              </li>
              <li>
                <Icon name="check" /> Network chosen with the asset, with clear warnings
              </li>
              <li>
                <Icon name="check" /> A dedicated desk for {formatUsd(PRICING_POLICY.retailMaximumCents, { whole: true })}+
              </li>
            </ul>
          </div>
          <div className="hero__calc">
            <Calculator />
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="anatomy-title">
        <div className="container anatomy">
          <div className="section-head">
            <p className="eyebrow">Quote anatomy</p>
            <h2 id="anatomy-title" className="display-m">
              Nothing folded into the price.
            </h2>
            <p className="lead">
              Many services build their margin into the rate they show you. We list the reference price, the spread and the payout fee
              separately, so you can check the math yourself.
            </p>
          </div>
          <div className="anatomy__grid">
            <ol className="anatomy__notes">
              <li>
                <span className="anatomy__num">1</span>
                <div>
                  <h3>Reference price</h3>
                  <p>A market mid-price for the asset at the moment of the quote.</p>
                </div>
              </li>
              <li>
                <span className="anatomy__num">2</span>
                <div>
                  <h3>Exchange spread</h3>
                  <p>Our margin, shown in dollars and as a percentage. It gets smaller as the amount gets larger.</p>
                </div>
              </li>
              <li>
                <span className="anatomy__num">3</span>
                <div>
                  <h3>Payout fee</h3>
                  <p>Set by the payout method you choose. Bank transfer has no payout fee.</p>
                </div>
              </li>
              <li>
                <span className="anatomy__num">4</span>
                <div>
                  <h3>You receive</h3>
                  <p>The exact dollar amount sent to you. The lines above always add up to it.</p>
                </div>
              </li>
            </ol>
            <figure className="panel anatomy__example">
              <div className="panel__head">
                <h3>Example quote</h3>
                <MockBadge label="Illustrative" />
              </div>
              <div className="panel__body">
                <QuoteBreakdown quote={EXAMPLE} />
              </div>
              <figcaption className="small muted anatomy__caption">
                Example only: 1.5 ETH at an illustrative $3,400.00, paid by bank transfer.
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="how-title">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2 id="how-title" className="display-m">
              Four steps, one status page.
            </h2>
          </div>
          <ol className="steps-row">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="steps-row__num tabular">{String(i + 1).padStart(2, '0')}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
          <p style={{ marginTop: 32 }}>
            <Link to="/how-it-works">
              Read the full walkthrough <span aria-hidden="true">→</span>
            </Link>
          </p>
        </div>
      </section>

      <section className="section" aria-labelledby="assets-title">
        <div className="container two-col">
          <div className="section-head">
            <p className="eyebrow">Assets and networks</p>
            <h2 id="assets-title" className="display-m">
              Pick the asset and its network together.
            </h2>
            <p className="lead">
              The same token can exist on several networks. We ask for both up front, and repeat the network on the deposit screen, so funds
              are sent where they can be received.
            </p>
          </div>
          <div className="table-wrap">
            <table className="data-table data-table--stack">
              <caption>
                Confirmation counts are demo policy values. <MockBadge label="Demo policy" />
              </caption>
              <thead>
                <tr>
                  <th scope="col">Asset</th>
                  <th scope="col">Networks</th>
                  <th scope="col">Confirmations</th>
                </tr>
              </thead>
              <tbody>
                {ASSET_ORDER.map((code) => {
                  const a = ASSETS[code];
                  return (
                    <tr key={code}>
                      <th scope="row">
                        <span className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                          <AssetMark code={code} />
                          <span>
                            {code}
                            <span className="small muted" style={{ display: 'block', fontWeight: 400 }}>
                              {a.name}
                            </span>
                          </span>
                        </span>
                      </th>
                      <td data-label="Networks">{a.networks.map((n) => networkLabel(code, n.network)).join(', ')}</td>
                      <td data-label="Confirmations" className="tabular">
                        {a.networks.map((n) => `${NETWORKS[n.network].confirmationsRequired} on ${NETWORKS[n.network].name}`).join(' · ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="payout-title">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Payouts</p>
            <h2 id="payout-title" className="display-m">
              Choose how dollars reach you.
            </h2>
            <p className="lead">Timings are estimates. They depend on confirmations, reviews and your bank, and are never guaranteed.</p>
          </div>
          <ul className="payout-grid">
            {PAYOUT_ORDER.map((id) => {
              const m = PAYOUT_METHODS[id];
              const off = !m.availability.available;
              return (
                <li key={id} className="payout-card" data-disabled={off || undefined}>
                  <Icon
                    name={id === 'ach' ? 'bank' : id === 'wire' ? 'wire' : id === 'instant_debit' ? 'card' : 'cash'}
                    className="payout-card__icon"
                  />
                  <h3>{m.name}</h3>
                  <p className="small muted">{m.summary}</p>
                  <dl className="payout-card__facts">
                    <div>
                      <dt>Timing</dt>
                      <dd>{m.timingEstimate}</dd>
                    </div>
                    <div>
                      <dt>Fee</dt>
                      <dd>{off ? '—' : describeFee(m.fee)}</dd>
                    </div>
                  </dl>
                  {off ? (
                    <p className="small">
                      <span className="badge badge--neutral">Not offered</span> <Link to="/cash-delivery">Why</Link>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="band" aria-labelledby="large-title">
        <div className="container band__grid">
          <div className="stack">
            <p className="eyebrow eyebrow--on-dark">Large transactions</p>
            <h2 id="large-title" className="display-m">
              Selling {formatUsd(PRICING_POLICY.retailMaximumCents, { whole: true })} or more?
            </h2>
            <p className="lead">
              Large amounts go through a desk rather than the online flow. You get enhanced verification, a negotiated price, and a wire to
              your bank account.
            </p>
          </div>
          <div className="stack band__aside">
            <ul className="band__list">
              <li>Request a quote with the asset, network and approximate size</li>
              <li>Complete enhanced verification and source-of-funds review</li>
              <li>Agree on a price, then send and receive by wire</li>
            </ul>
            <Link className="btn btn--lg btn--on-dark" to="/large-transactions">
              Request a large-transaction quote
            </Link>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="security-title">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">Security and compliance</p>
            <h2 id="security-title" className="display-m">
              Designed for regulated operation.
            </h2>
            <p className="lead">
              These controls are built into the product design. In this demo they are simulated. None of them is a claim about a live
              service.
            </p>
          </div>
          <ul className="pillars">
            <li>
              <Icon name="user" />
              <h3>Identity verification</h3>
              <p>Customers verify their identity before their first exchange. Large transactions need enhanced checks.</p>
            </li>
            <li>
              <Icon name="shield" />
              <h3>Screening</h3>
              <p>Refund addresses and transactions are screened against sanctions and blockchain-risk data before payout.</p>
            </li>
            <li>
              <Icon name="lock" />
              <h3>Account protection</h3>
              <p>Two-step sign-in, saved payout destinations stored only as the last four digits, and time-limited sessions.</p>
            </li>
          </ul>
          <p style={{ marginTop: 32 }}>
            <Link to="/security">
              How we approach security <span aria-hidden="true">→</span>
            </Link>
          </p>
        </div>
      </section>

      <section className="section" aria-labelledby="faq-title">
        <div className="container two-col">
          <div className="section-head">
            <p className="eyebrow">Questions</p>
            <h2 id="faq-title" className="display-m">
              Before you start.
            </h2>
            <p>
              <Link to="/faq">All questions</Link> · <Link to="/help">Help center</Link>
            </p>
          </div>
          <FaqList
            items={FAQ.filter((f) =>
              [
                'Is this a live exchange?',
                'How is my payout calculated?',
                'What happens if I send on the wrong network?',
                'Will anyone from your team ask me to send crypto?',
              ].includes(f.q),
            )}
          />
        </div>
      </section>
    </>
  );
}
