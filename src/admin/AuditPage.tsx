import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatDateTime } from '@/lib/format';
import { useServices } from '@/state/services';
import { AdminHead, LoadError, Pager } from './shared';
import { useLoad } from './lib';
import { t } from '@/i18n';

const FILTERS = [
  ['action', 'Action', 'order.payout_authorized'],
  ['targetType', 'Target type', 'order, user, conversation'],
  ['targetId', 'Target id', ''],
  ['actorId', 'Actor id', ''],
] as const;

/** The append-only, hash-chained audit log. Entries can't be edited or deleted; the chain is verified on the System page. */
export function AuditPage() {
  const { admin } = useServices();
  const [params, setParams] = useSearchParams();
  const f = Object.fromEntries(FILTERS.map(([k]) => [k, params.get(k) ?? ''])) as Record<(typeof FILTERS)[number][0], string>;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const { data, error } = useLoad(() => admin.audit({ ...f, page }), [params.toString()]);
  const [draft, setDraft] = useState(f);
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="stack stack--lg">
      <AdminHead
        title={t('Audit log')}
        lead={t('Every staff action, provider event and sign-in, newest first. Entries are append-only and hash-chained.')}
      />
      <form
        className="filters"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          const next = new URLSearchParams();
          for (const [k, v] of Object.entries(draft)) if (v.trim()) next.set(k, v.trim());
          setParams(next);
        }}
      >
        {FILTERS.map(([k, label, ph]) => (
          <div className="field" key={k}>
            <label className="field__label" htmlFor={`a-${k}`}>
              {t(label)}
            </label>
            <input
              id={`a-${k}`}
              className="input"
              value={draft[k]}
              placeholder={ph}
              onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
            />
          </div>
        ))}
        <div className="filters__submit">
          <button type="submit" className="btn btn--secondary">
            {t('Filter')}
          </button>
        </div>
      </form>
      <LoadError error={error} />
      {data ? (
        <>
          <div className="table-wrap" tabIndex={0} role="region" aria-label={t('Audit log')}>
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">{t('When')}</th>
                  <th scope="col">{t('Actor')}</th>
                  <th scope="col">{t('Action')}</th>
                  <th scope="col">{t('Target')}</th>
                  <th scope="col">{t('Reason')}</th>
                  <th scope="col">{t('Details')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td className="tabular small">{a.id}</td>
                    <td className="tabular small">{formatDateTime(a.at)}</td>
                    <td className="small">
                      {t(a.actor.type)}
                      {a.actor.role ? ` (${t(a.actor.role)})` : ''}
                      {a.actor.id ? <span className="mono block">{a.actor.id}</span> : null}
                    </td>
                    <td className="mono small">{a.action}</td>
                    <td className="small">
                      {a.target ? (
                        a.target.type === 'order' && a.target.id ? (
                          <Link to={`/admin/orders/${a.target.id}`} className="mono">
                            {a.target.id}
                          </Link>
                        ) : (
                          <span className="mono">
                            {a.target.type}:{a.target.id}
                          </span>
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="small">{a.reason ?? '—'}</td>
                    <td className="small">
                      <button
                        type="button"
                        className="link-button"
                        aria-expanded={open === a.id}
                        onClick={() => setOpen(open === a.id ? null : a.id)}
                      >
                        {open === a.id ? t('Hide') : t('Show')}
                      </button>
                      {open === a.id ? (
                        <pre className="audit-data">{JSON.stringify({ ...a.data, ip: a.ip, hash: a.hash }, null, 2)}</pre>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      {t('No entries match.')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <Pager
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPage={(p) =>
              setParams((prev) => {
                const n = new URLSearchParams(prev);
                n.set('page', String(p));
                return n;
              })
            }
          />
        </>
      ) : !error ? (
        <p className="muted">{t('Loading…')}</p>
      ) : null}
    </div>
  );
}
