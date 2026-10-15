import { useIsSandbox } from '@/state/config';
import { Link } from 'react-router-dom';
import { Calculator } from '@/components/Calculator';
import { Icon } from '@/components/Icon';
import { QuoteBreakdown } from '@/components/QuoteBreakdown';
import { AssetMark, MockBadge } from '@/components/ui';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { FAQ, FaqList } from '@/content/faq';
import { ASSET_ORDER, ASSETS, NETWORKS, networkLabel } from '@/domain/assets';
import { formatUsd } from '@/domain/money';
import { describeFee, PAYOUT_METHODS, PAYOUT_ORDER } from '@/domain/payout';
import { calculateQuote, PRICING_POLICY } from '@/domain/quote';
import { t } from '@/i18n';

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
  {
    title: 'Choose your payout',
    body: 'Bank transfer, wire, debit card or cash by courier. Each option shows its fee and estimated timing.',
  },
  { title: 'Send your crypto', body: 'Confirm, then send to the deposit address shown, on the network shown, before the window closes.' },
  { title: 'Receive dollars', body: 'Track confirmations and your payout on one status page. Every step is time-stamped.' },
];

export function HomePage() {
  useDocumentTitle('');
  const sandbox = useIsSandbox();
  return (
    <>
      <section className="hero">
        <div className="container hero__grid">
          <div className="hero__copy">
            <p className="hero-pill">
              <span className="hero-pill__dot" aria-hidden="true" />
              {t('Crypto to US dollars')}
            </p>
            {/* The brand slogan stays in English in both languages, as on the brand board. */}
            <h1 className="display-xl hero__title" lang="en">
              Exchange
              <br />
              <span className="gold">Without Limits</span>
            </h1>
            <p className="hero__tagline" lang="en">
              Fast. Secure. Global.
            </p>
            <p className="lead">
              {t(
                'Send BTC, ETH, USDT or USDC and receive US dollars in your bank account, with the exchange rate and the payout fee listed as separate lines.',
              )}
            </p>
            <div className="row hero__ctas">
              <Link className="btn btn--lg" to="/exchange">
                {t('Start an exchange')} <Icon name="arrowUpRight" width={18} height={18} />
              </Link>
              <Link className="btn btn--lg btn--secondary" to="/how-it-works">
                <span className="play-dot" aria-hidden="true">
                  <Icon name="play" width={14} height={14} />
                </span>
                {t('How it works')}
              </Link>
            </div>
          </div>
          <div className="hero__art">
            <div className="hero-globe">
              <img src="/brand/cryptobit-mark.webp" alt="" width="312" height="220" decoding="async" fetchPriority="high" />
            </div>
          </div>
        </div>
        <div className="container">
          <ul className="stat-row" aria-label={t('At a glance')}>
            <li className="stat">
              <span className="stat__icon">
                <Icon name="layers" />
              </span>
              <span>
                <strong>
                  {ASSET_ORDER.length} {t('assets')}
                </strong>
                <span>{ASSET_ORDER.join(', ')}</span>
              </span>
            </li>
            <li className="stat">
              <span className="stat__icon">
                <Icon name="globe" />
              </span>
              <span>
                <strong>
                  {Object.keys(NETWORKS).length} {t('networks')}
                </strong>
                <span>{t('Chosen together with the asset')}</span>
              </span>
            </li>
            <li className="stat">
              <span className="stat__icon">
                <Icon name="lock" />
              </span>
              <span>
                <strong>{t('No maximum')}</strong>
                <span>
                  {t('From')} {formatUsd(PRICING_POLICY.minimumCents, { whole: true })} {t('per exchange')}
                </span>
              </span>
            </li>
            <li className="stat">
              <span className="stat__icon">
                <Icon name="bank" />
              </span>
              <span>
                <strong>{t('$0 ACH fee')}</strong>
                <span>{t(PAYOUT_METHODS.ach.timingEstimate)}</span>
              </span>
            </li>
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="quote-title">
        <div className="container quote-band">
          <div className="section-head">
            <p className="eyebrow">{t('Get a quote')}</p>
            <h2 id="quote-title" className="display-m">
              {t('See exactly what you will receive.')}
            </h2>
            <ul className="check-list">
              <li>
                <Icon name="check" /> {t('One quote and one status page, from deposit to payout')}
              </li>
              <li>
                <Icon name="check" /> {t('Network chosen with the asset, with clear warnings')}
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
            <p className="eyebrow">{t('Quote anatomy')}</p>
            <h2 id="anatomy-title" className="display-m">
              {t('Every charge on its own line.')}
            </h2>
            <p className="lead">
              {t(
                'We list the exchange rate and the payout fee separately, so you can check the math yourself. How the commission is defined is set out in Section 6 of the',
              )}{' '}
              <Link to="/legal/fees">{t('Service Rules')}</Link>.
            </p>
          </div>
          <div className="anatomy__grid">
            <ol className="anatomy__notes">
              <li>
                <span className="anatomy__num">1</span>
                <div>
                  <h3>{t('Exchange rate')}</h3>
                  <p>{t('The rate you get per coin at the moment of the quote, with our commission already included.')}</p>
                </div>
              </li>
              <li>
                <span className="anatomy__num">2</span>
                <div>
                  <h3>{t('Payout fee')}</h3>
                  <p>{t('Set by the payout method you choose. Bank transfer has no payout fee.')}</p>
                </div>
              </li>
              <li>
                <span className="anatomy__num">3</span>
                <div>
                  <h3>{t('You receive')}</h3>
                  <p>{t('The exact dollar amount sent to you. The lines above always add up to it.')}</p>
                </div>
              </li>
            </ol>
            <figure className="panel anatomy__example">
              <div className="panel__head">
                <h3>{t('Example quote')}</h3>
                <MockBadge label={t('Illustrative')} />
              </div>
              <div className="panel__body">
                <QuoteBreakdown quote={EXAMPLE} />
              </div>
              <figcaption className="small muted anatomy__caption">
                {t('Example only: 1.5 ETH at an illustrative $3,400.00, paid by bank transfer.')}
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="how-title">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">{t('How it works')}</p>
            <h2 id="how-title" className="display-m">
              {t('Four steps, one status page.')}
            </h2>
          </div>
          <ol className="steps-row">
            {STEPS.map((s, i) => (
              <li key={t(s.title)}>
                <span className="steps-row__num tabular">{String(i + 1).padStart(2, '0')}</span>
                <h3>{t(s.title)}</h3>
                <p>{t(s.body)}</p>
              </li>
            ))}
          </ol>
          <p style={{ marginTop: 32 }}>
            <Link to="/how-it-works">
              {t('Read the full walkthrough')} <span aria-hidden="true">→</span>
            </Link>
          </p>
        </div>
      </section>

      <section className="section" aria-labelledby="assets-title">
        <div className="container two-col">
          <div className="section-head">
            <p className="eyebrow">{t('Assets and networks')}</p>
            <h2 id="assets-title" className="display-m">
              {t('Pick the asset and its network together.')}
            </h2>
            <p className="lead">
              {t(
                'The same token can exist on several networks. We ask for both up front, and repeat the network on the deposit screen, so funds are sent where they can be received.',
              )}
            </p>
          </div>
          <div className="table-wrap" tabIndex={0} role="region" aria-label={t('Comparison')}>
            <table className="data-table data-table--stack">
              <caption>
                {t('Confirmation counts follow Section 5 of the Service Rules where it sets them.')}{' '}
                <MockBadge label={t('Sandbox policy')} />
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t('Asset')}</th>
                  <th scope="col">{t('Networks')}</th>
                  <th scope="col">{t('Confirmations')}</th>
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
                      <td data-label={t('Networks')}>{a.networks.map((n) => networkLabel(code, n.network)).join(', ')}</td>
                      <td data-label={t('Confirmations')} className="tabular">
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
            <p className="eyebrow">{t('Payouts')}</p>
            <h2 id="payout-title" className="display-m">
              {t('Choose how dollars reach you.')}
            </h2>
            <p className="lead">
              {t('Timings are estimates. They depend on confirmations, reviews and your bank, and are never guaranteed.')}
            </p>
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
                  <h3>{t(m.name)}</h3>
                  <p className="small muted">{t(m.summary)}</p>
                  <dl className="payout-card__facts">
                    <div>
                      <dt>{t('Timing')}</dt>
                      <dd>{t(m.timingEstimate)}</dd>
                    </div>
                    <div>
                      <dt>{t('Fee')}</dt>
                      <dd>{off ? '—' : t(describeFee(m.fee))}</dd>
                    </div>
                  </dl>
                  {off ? (
                    <p className="small">
                      <span className="badge badge--neutral">{t('Not offered')}</span> <Link to="/cash-delivery">{t('Why')}</Link>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="security-title">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">{t('Security and compliance')}</p>
            <h2 id="security-title" className="display-m">
              {t('Designed for regulated operation.')}
            </h2>
            <p className="lead">
              {t('These controls run on our server for every order.')}
              {sandbox ? t(' In the sandbox, the providers behind them are simulated.') : ''}{' '}
              {t('None of them is a claim of licensing or insurance.')}
            </p>
          </div>
          <ul className="pillars">
            <li>
              <Icon name="user" />
              <h3>{t('Identity verification')}</h3>
              <p>
                {t('Customers verify their identity before their first exchange. High-risk transactions may need additional documents.')}
              </p>
            </li>
            <li>
              <Icon name="shield" />
              <h3>{t('Screening')}</h3>
              <p>
                {t(
                  'Transactions are screened against sanctions and blockchain-risk data before payout, and refund addresses before any refund.',
                )}
              </p>
            </li>
            <li>
              <Icon name="lock" />
              <h3>{t('Account protection')}</h3>
              <p>{t('Two-step sign-in, saved payout destinations stored only as the last four digits, and time-limited sessions.')}</p>
            </li>
          </ul>
          <p style={{ marginTop: 32 }}>
            <Link to="/security">
              {t('How we approach security')} <span aria-hidden="true">→</span>
            </Link>
          </p>
        </div>
      </section>

      <section className="section" aria-labelledby="faq-title">
        <div className="container two-col">
          <div className="section-head">
            <p className="eyebrow">{t('Questions')}</p>
            <h2 id="faq-title" className="display-m">
              {t('Before you start.')}
            </h2>
            <p>
              <Link to="/faq">{t('All questions')}</Link> · <Link to="/help">{t('Help center')}</Link>
            </p>
          </div>
          <FaqList
            items={FAQ.filter((f) =>
              [
                'Can I exchange real funds today?',
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
