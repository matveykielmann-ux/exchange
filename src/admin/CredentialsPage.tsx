import { useState, type FormEvent } from 'react';
import { ASSETS, ASSET_ORDER, NETWORKS, type AssetCode, type NetworkId } from '@/domain/assets';
import { Icon } from '@/components/Icon';
import { formatDateTime } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { t } from '@/i18n';
import type { CryptoWallet, CryptoWalletInput, WireCredentialInput, WireCredentialSet } from '@/services/adminTypes';
import { useUser } from '@/state/auth';
import { useServices } from '@/state/services';
import { AdminHead, LoadError } from './shared';
import { atLeast, useLoad } from './lib';

type Tab = 'wire' | 'wallets';

function CopyBtn({ value }: { value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {
          /* ignore */
        }
      }}
    >
      <Icon name="copy" width={14} height={14} /> {ok ? t('Copied') : t('Copy')}
    </button>
  );
}

const emptyWire = (): WireCredentialInput => ({
  name: '',
  beneficiary: '',
  bankName: '',
  accountNumber: '',
  routingNumber: '',
  swiftBic: '',
  bankAddress: '',
  instructions: '',
  currency: 'USD',
});

const emptyWallet = (): CryptoWalletInput => ({
  name: '',
  asset: null,
  network: null,
  address: '',
  purpose: 'deposit',
  note: '',
});

function WireForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: WireCredentialSet;
  onSave(input: WireCredentialInput): Promise<void>;
  onCancel(): void;
}) {
  const [form, setForm] = useState<WireCredentialInput>(
    initial
      ? {
          name: initial.name,
          beneficiary: initial.beneficiary,
          bankName: initial.bankName,
          accountNumber: initial.accountNumber ?? '',
          routingNumber: initial.routingNumber ?? '',
          swiftBic: initial.swiftBic ?? '',
          bankAddress: initial.bankAddress ?? '',
          instructions: initial.instructions ?? '',
          currency: 'USD',
        }
      : emptyWire(),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof WireCredentialInput, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form
      className="stack card"
      style={{ gap: 10, padding: 16 }}
      onSubmit={async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await onSave({
            ...form,
            accountNumber: form.accountNumber || null,
            routingNumber: form.routingNumber || null,
            swiftBic: form.swiftBic || null,
            bankAddress: form.bankAddress || null,
            instructions: form.instructions || null,
          });
        } catch (ex) {
          setErr(errorMessage(ex));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 className="order-block__title">{initial ? t('Edit bank set') : t('Add bank set')}</h3>
      {(
        [
          ['name', t('Internal name'), 'USD Wire — Account 1'],
          ['beneficiary', t('Beneficiary'), ''],
          ['bankName', t('Bank name'), ''],
          ['accountNumber', t('Account number / IBAN'), ''],
          ['routingNumber', t('Routing number / ABA'), ''],
          ['swiftBic', t('SWIFT / BIC'), ''],
          ['bankAddress', t('Bank address'), ''],
        ] as const
      ).map(([key, label, ph]) => (
        <label key={key} className="field">
          <span className="field__label">{label}</span>
          <input className="input" value={(form[key] as string) ?? ''} placeholder={ph} onChange={(e) => set(key, e.target.value)} />
        </label>
      ))}
      <label className="field">
        <span className="field__label">{t('Instructions for customer')}</span>
        <textarea className="textarea" rows={3} value={form.instructions ?? ''} onChange={(e) => set('instructions', e.target.value)} />
      </label>
      {err ? (
        <p className="small" role="alert" style={{ color: 'var(--danger)' }}>
          {err}
        </p>
      ) : null}
      <div className="row" style={{ gap: 8 }}>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? t('Saving…') : t('Save')}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          {t('Cancel')}
        </button>
      </div>
    </form>
  );
}

function WalletForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: CryptoWallet;
  onSave(input: CryptoWalletInput): Promise<void>;
  onCancel(): void;
}) {
  const [form, setForm] = useState<CryptoWalletInput>(
    initial
      ? {
          name: initial.name,
          asset: initial.asset,
          network: initial.network,
          address: initial.address,
          purpose: initial.purpose,
          note: initial.note ?? '',
        }
      : emptyWallet(),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const networksForAsset = (asset: AssetCode | null | undefined): NetworkId[] =>
    asset ? ASSETS[asset].networks.map((n) => n.network) : (Object.keys(NETWORKS) as NetworkId[]);
  return (
    <form
      className="stack card"
      style={{ gap: 10, padding: 16 }}
      onSubmit={async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await onSave({
            ...form,
            asset: form.asset || null,
            network: form.network || null,
            note: form.note || null,
          });
        } catch (ex) {
          setErr(errorMessage(ex));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 className="order-block__title">{initial ? t('Edit wallet') : t('Add wallet')}</h3>
      <label className="field">
        <span className="field__label">{t('Internal name')}</span>
        <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </label>
      <div className="row" style={{ gap: 10 }}>
        <label className="field" style={{ flex: 1 }}>
          <span className="field__label">{t('Asset')}</span>
          <select
            className="select"
            value={form.asset ?? ''}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                asset: (e.target.value || null) as AssetCode | null,
                network: null,
              }))
            }
          >
            <option value="">{t('— select / EVM template —')}</option>
            {ASSET_ORDER.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span className="field__label">{t('Network')}</span>
          <select
            className="select"
            value={form.network ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, network: (e.target.value || null) as NetworkId | null }))}
          >
            <option value="">{t('— select network —')}</option>
            {networksForAsset(form.asset).map((n) => (
              <option key={n} value={n}>
                {NETWORKS[n].name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span className="field__label">{t('Wallet address')}</span>
        <input
          className="input mono"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          spellCheck={false}
        />
      </label>
      <label className="field">
        <span className="field__label">{t('Purpose')}</span>
        <select
          className="select"
          value={form.purpose ?? 'deposit'}
          onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value as 'deposit' | 'payout' }))}
        >
          <option value="deposit">{t('Incoming deposit')}</option>
          <option value="payout">{t('Outgoing transfer')}</option>
        </select>
      </label>
      <label className="field">
        <span className="field__label">{t('Internal note')}</span>
        <textarea className="textarea" rows={2} value={form.note ?? ''} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
      </label>
      <p className="small muted">{t('Private keys and seed phrases must never be stored here.')}</p>
      {err ? (
        <p className="small" role="alert" style={{ color: 'var(--danger)' }}>
          {err}
        </p>
      ) : null}
      <div className="row" style={{ gap: 8 }}>
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? t('Saving…') : t('Save')}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          {t('Cancel')}
        </button>
      </div>
    </form>
  );
}

/** CRM: bank wire sets and crypto deposit wallets. */
export function CredentialsPage() {
  const { admin } = useServices();
  const me = useUser();
  const canEdit = atLeast(me?.role, 'admin');
  const [tab, setTab] = useState<Tab>('wire');
  const wire = useLoad(() => admin.credentials.listWire(), []);
  const wallets = useLoad(() => admin.credentials.listWallets(), []);
  const [editingWire, setEditingWire] = useState<WireCredentialSet | 'new' | null>(null);
  const [editingWallet, setEditingWallet] = useState<CryptoWallet | 'new' | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const reload = () => {
    wire.reload();
    wallets.reload();
  };

  return (
    <div className="stack">
      <AdminHead title={t('Credentials & wallets')} lead={t('Bank wire sets and crypto deposit addresses used for new orders. Existing orders keep their snapshot.')} />
      <div className="row" role="tablist" aria-label={t('Credential type')} style={{ gap: 8 }}>
        <button type="button" role="tab" aria-selected={tab === 'wire'} className={`btn ${tab === 'wire' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTab('wire')}>
          <Icon name="bank" width={16} height={16} /> {t('Bank credentials (Wire)')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'wallets'}
          className={`btn ${tab === 'wallets' ? 'btn--primary' : 'btn--secondary'}`}
          onClick={() => setTab('wallets')}
        >
          <Icon name="layers" width={16} height={16} /> {t('Crypto wallets')}
        </button>
      </div>
      {actionErr ? (
        <p className="small" role="alert" style={{ color: 'var(--danger)' }}>
          {actionErr}
        </p>
      ) : null}

      {tab === 'wire' ? (
        <section className="stack" aria-label={t('Bank credentials')}>
          <LoadError error={wire.error} />
          {canEdit ? (
            editingWire ? (
              <WireForm
                initial={editingWire === 'new' ? undefined : editingWire}
                onCancel={() => setEditingWire(null)}
                onSave={async (input) => {
                  if (editingWire === 'new') await admin.credentials.createWire(input);
                  else await admin.credentials.updateWire(editingWire.id, input);
                  setEditingWire(null);
                  reload();
                }}
              />
            ) : (
              <button type="button" className="btn btn--secondary" onClick={() => setEditingWire('new')}>
                {t('Add bank set')}
              </button>
            )
          ) : null}
          {!wire.data ? (
            <p className="muted">{t('Loading…')}</p>
          ) : wire.data.length === 0 ? (
            <p className="muted">{t('No bank credential sets yet.')}</p>
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              {wire.data.map((w) => (
                <article key={w.id} className="card stack" style={{ padding: 16, gap: 8 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong>{w.name}</strong>{' '}
                      {w.isDefault ? <span className="badge badge--info">{t('Default')}</span> : null}{' '}
                      <span className={`badge ${w.status === 'active' ? 'badge--success' : 'badge--warn'}`}>{t(w.status)}</span>
                    </div>
                    <CopyBtn
                      value={[
                        `Beneficiary: ${w.beneficiary}`,
                        `Bank: ${w.bankName}`,
                        w.accountNumber ? `Account: ${w.accountNumber}` : null,
                        w.routingNumber ? `Routing: ${w.routingNumber}` : null,
                        w.swiftBic ? `SWIFT: ${w.swiftBic}` : null,
                      ]
                        .filter(Boolean)
                        .join('\n')}
                    />
                  </div>
                  <dl className="dl dl--compact">
                    <div>
                      <dt>{t('Beneficiary')}</dt>
                      <dd>{w.beneficiary}</dd>
                    </div>
                    <div>
                      <dt>{t('Bank')}</dt>
                      <dd>{w.bankName}</dd>
                    </div>
                    {w.accountNumber ? (
                      <div>
                        <dt>{t('Account / IBAN')}</dt>
                        <dd className="mono">{w.accountNumber}</dd>
                      </div>
                    ) : null}
                    {w.routingNumber ? (
                      <div>
                        <dt>{t('Routing')}</dt>
                        <dd className="mono">{w.routingNumber}</dd>
                      </div>
                    ) : null}
                    {w.swiftBic ? (
                      <div>
                        <dt>SWIFT</dt>
                        <dd className="mono">{w.swiftBic}</dd>
                      </div>
                    ) : null}
                  </dl>
                  <p className="small muted">
                    {t('Updated')} {formatDateTime(w.updatedAt)}
                    {w.inUse ? ` · ${t('Used on existing orders')}` : ''}
                  </p>
                  {canEdit ? (
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn--ghost" onClick={() => setEditingWire(w)}>
                        {t('Edit')}
                      </button>
                      {w.status === 'active' && !w.isDefault ? (
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={async () => {
                            try {
                              await admin.credentials.setWireDefault(w.id);
                              reload();
                            } catch (e) {
                              setActionErr(errorMessage(e));
                            }
                          }}
                        >
                          {t('Set default')}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={async () => {
                          try {
                            await admin.credentials.setWireStatus(w.id, w.status === 'active' ? 'suspended' : 'active');
                            reload();
                          } catch (e) {
                            setActionErr(errorMessage(e));
                          }
                        }}
                      >
                        {w.status === 'active' ? t('Suspend') : t('Activate')}
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="stack" aria-label={t('Crypto wallets')}>
          <LoadError error={wallets.error} />
          {canEdit ? (
            editingWallet ? (
              <WalletForm
                initial={editingWallet === 'new' ? undefined : editingWallet}
                onCancel={() => setEditingWallet(null)}
                onSave={async (input) => {
                  if (editingWallet === 'new') await admin.credentials.createWallet(input);
                  else await admin.credentials.updateWallet(editingWallet.id, input);
                  setEditingWallet(null);
                  reload();
                }}
              />
            ) : (
              <button type="button" className="btn btn--secondary" onClick={() => setEditingWallet('new')}>
                {t('Add wallet')}
              </button>
            )
          ) : null}
          {!wallets.data ? (
            <p className="muted">{t('Loading…')}</p>
          ) : wallets.data.length === 0 ? (
            <p className="muted">{t('No wallets yet.')}</p>
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              {wallets.data.map((w) => (
                <article key={w.id} className="card stack" style={{ padding: 16, gap: 8 }}>
                  <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong>{w.name}</strong>{' '}
                      {w.isDefault ? <span className="badge badge--info">{t('Default')}</span> : null}{' '}
                      <span
                        className={`badge ${w.status === 'active' ? 'badge--success' : w.status === 'pending_network' ? 'badge--neutral' : 'badge--warn'}`}
                      >
                        {t(w.status === 'pending_network' ? 'needs network' : w.status)}
                      </span>
                    </div>
                    <CopyBtn value={w.address} />
                  </div>
                  <p className="mono small break">{w.address}</p>
                  <p className="small">
                    {w.asset && w.network ? (
                      <>
                        {w.asset} · {NETWORKS[w.network].name} · {t(w.purpose)}
                      </>
                    ) : (
                      <span className="muted">{t('EVM address — choose a specific network before use')}</span>
                    )}
                  </p>
                  {w.note ? <p className="small muted">{w.note}</p> : null}
                  <p className="small muted">
                    {t('Created')} {formatDateTime(w.createdAt)} · {t('Updated')} {formatDateTime(w.updatedAt)}
                    {w.inUse ? ` · ${t('Used on existing orders')}` : ''}
                  </p>
                  {canEdit ? (
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn--ghost" onClick={() => setEditingWallet(w)}>
                        {t('Edit')}
                      </button>
                      {w.status === 'active' && !w.isDefault ? (
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={async () => {
                            try {
                              await admin.credentials.setWalletDefault(w.id);
                              reload();
                            } catch (e) {
                              setActionErr(errorMessage(e));
                            }
                          }}
                        >
                          {t('Set default')}
                        </button>
                      ) : null}
                      {w.status !== 'pending_network' ? (
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={async () => {
                            try {
                              await admin.credentials.setWalletStatus(w.id, w.status === 'active' ? 'suspended' : 'active');
                              reload();
                            } catch (e) {
                              setActionErr(errorMessage(e));
                            }
                          }}
                        >
                          {w.status === 'active' ? t('Suspend') : t('Activate')}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
