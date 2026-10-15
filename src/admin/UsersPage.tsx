import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { formatDateTime } from '@/lib/format';
import type { UserRow } from '@/services/adminTypes';
import type { Role } from '@/services/types';
import { useUser } from '@/state/auth';
import { useServices } from '@/state/services';
import { AdminHead, LoadError, Pager, ReasonForm } from './shared';
import { atLeast, ROLE_LABEL, useLoad } from './lib';
import { t } from '@/i18n';

const ROLES: Role[] = ['customer', 'support', 'reviewer', 'admin', 'owner'];

function UserActions({ user, onDone }: { user: UserRow; onDone(): void }) {
  const { admin } = useServices();
  const me = useUser();
  const [mode, setMode] = useState<'role' | 'status' | null>(null);
  const [role, setRole] = useState<Role>(user.role);
  if (me?.id === user.id) return <span className="small muted">{t('You')}</span>;
  // Admins can grant up to reviewer; owners can grant any role (enforced on the server).
  const grantable = ROLES.filter((r) => me?.role === 'owner' || !atLeast(r, 'admin'));
  const canTouch = me?.role === 'owner' || !atLeast(user.role, 'admin');
  if (!canTouch) return <span className="small muted">{t('Owner only')}</span>;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ gap: 6 }}>
        <button
          type="button"
          className="btn btn--ghost"
          aria-expanded={mode === 'role'}
          onClick={() => setMode(mode === 'role' ? null : 'role')}
        >
          {t('Change role')}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          aria-expanded={mode === 'status'}
          onClick={() => setMode(mode === 'status' ? null : 'status')}
        >
          {user.status === 'active' ? t('Disable') : t('Enable')}
        </button>
      </div>
      {mode === 'role' ? (
        <ReasonForm
          id={`role-${user.id}`}
          submitLabel={t('Save role')}
          onCancel={() => setMode(null)}
          onSubmit={async (reason) => {
            await admin.changeRole(user.id, role, reason);
            setMode(null);
            onDone();
          }}
        >
          <label className="field__label" htmlFor={`role-sel-${user.id}`}>
            {t('New role')}
          </label>
          <select id={`role-sel-${user.id}`} className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {grantable.map((r) => (
              <option key={r} value={r}>
                {t(ROLE_LABEL[r])}
              </option>
            ))}
          </select>
        </ReasonForm>
      ) : null}
      {mode === 'status' ? (
        <ReasonForm
          id={`status-${user.id}`}
          submitLabel={user.status === 'active' ? t('Disable account') : t('Enable account')}
          danger={user.status === 'active'}
          onCancel={() => setMode(null)}
          onSubmit={async (reason) => {
            await admin.setUserStatus(user.id, user.status === 'active' ? 'disabled' : 'active', reason);
            setMode(null);
            onDone();
          }}
        />
      ) : null}
    </div>
  );
}

/** Accounts and roles. Role and status changes need a reason and are written to the audit log. */
export function UsersPage() {
  const { admin } = useServices();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const role = (ROLES.find((r) => r === params.get('role')) ?? '') as Role | '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const { data, error, reload } = useLoad(() => admin.users({ q, role, page }), [q, role, page]);
  const [search, setSearch] = useState(q);
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch))
      if (v) next.set(k, v);
      else next.delete(k);
    if (!('page' in patch)) next.delete('page');
    setParams(next);
  };
  return (
    <div className="stack stack--lg">
      <AdminHead title={t('Users and roles')} lead={t('Customer emails are masked. Staff accounts need two-step sign-in in production.')} />
      <form
        className="filters"
        role="search"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          set({ q: search.trim() || null });
        }}
      >
        <div className="field filters__search">
          <label className="field__label" htmlFor="u-q">
            {t('Search')}
          </label>
          <div className="input-with-button">
            <input
              id="u-q"
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Email, name or user id')}
            />
            <button type="submit" className="btn btn--secondary" aria-label={t('Search')}>
              <Icon name="search" width={18} height={18} />
            </button>
          </div>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="u-role">
            {t('Role')}
          </label>
          <select id="u-role" className="select" value={role} onChange={(e) => set({ role: e.target.value || null })}>
            <option value="">{t('Any role')}</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(ROLE_LABEL[r])}
              </option>
            ))}
          </select>
        </div>
      </form>
      <LoadError error={error} />
      {data ? (
        <>
          <div className="table-wrap" tabIndex={0} role="region" aria-label={t('Users')}>
            <table className="data-table admin-table">
              <thead>
                <tr>
                  <th scope="col">{t('User')}</th>
                  <th scope="col">{t('Role')}</th>
                  <th scope="col">{t('Status')}</th>
                  <th scope="col">{t('Verification')}</th>
                  <th scope="col">{t('2-step')}</th>
                  <th scope="col">{t('Created')}</th>
                  <th scope="col">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <th scope="row">
                      {u.name || '—'}
                      <span className="small muted block">{u.email}</span>
                    </th>
                    <td>{t(ROLE_LABEL[u.role])}</td>
                    <td>
                      <span className={`badge badge--${u.status === 'active' ? 'success' : 'neutral'}`}>{t(u.status)}</span>
                    </td>
                    <td className="small">{u.kycStatus ? t(u.kycStatus) : '—'}</td>
                    <td className="small">{u.totpEnabled ? t('On') : t('Off')}</td>
                    <td className="small tabular">{formatDateTime(u.createdAt)}</td>
                    <td>
                      <UserActions user={u} onDone={reload} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => set({ page: String(p) })} />
        </>
      ) : !error ? (
        <p className="muted">{t('Loading…')}</p>
      ) : null}
    </div>
  );
}
