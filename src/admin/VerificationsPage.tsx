import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { MockBadge, Notice } from '@/components/ui';
import { ID_DOCUMENT_LABEL, KYC_FILE_LABEL, type KycDecision, type KycSubmissionStatus } from '@/domain/identity';
import { countryName } from '@/domain/residence';
import { errorMessage } from '@/lib/errors';
import { base64ObjectUrl, formatFileSize } from '@/lib/files';
import { formatDateTime } from '@/lib/format';
import type { KycDetail, KycQueueFilter } from '@/services/adminTypes';
import type { KycFileView } from '@/services/types';
import { useConfig } from '@/state/config';
import { useServices } from '@/state/services';
import { AdminHead, LoadError, Pager, ReasonForm } from './shared';
import { useLoad } from './lib';
import { t } from '@/i18n';

const FILTERS: { value: KycQueueFilter; label: string }[] = [
  { value: 'submitted', label: 'Waiting for review' },
  { value: 'needs_info', label: 'More information requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const STATUS: Record<KycSubmissionStatus, { label: string; tone: 'info' | 'warn' | 'success' | 'danger' | 'neutral' }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  submitted: { label: 'Waiting for review', tone: 'info' },
  needs_info: { label: 'More information requested', tone: 'warn' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

const StatusChip = ({ status }: { status: KycSubmissionStatus }) => (
  <span className={`badge badge--${STATUS[status].tone}`}>{t(STATUS[status].label)}</span>
);

/** Identity verifications waiting for a reviewer. Reviewers, admins and owners only: support staff cannot open documents. */
export function VerificationsPage() {
  const { admin } = useServices();
  const [params, setParams] = useSearchParams();
  const status = FILTERS.find((f) => f.value === params.get('status'))?.value ?? 'submitted';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const { data, error } = useLoad(() => admin.kyc.queue({ status, page }), [status, page]);
  return (
    <div className="stack stack--lg">
      <AdminHead
        title={t('Identity verification')}
        lead={t('Photo ID, selfie and proof of address sent by customers. Every decision needs a reason and is written to the audit log.')}
      />
      <div className="filters">
        <div className="field">
          <label className="field__label" htmlFor="kyc-status">
            {t('Status')}
          </label>
          <select
            id="kyc-status"
            className="select"
            value={status}
            onChange={(e) => setParams(e.target.value === 'submitted' ? {} : { status: e.target.value })}
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {t(f.label)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <LoadError error={error} />
      {data ? (
        data.items.length === 0 ? (
          <p className="muted">{t('Nothing here.')}</p>
        ) : (
          <>
            <div className="table-wrap" tabIndex={0} role="region" aria-label={t('Identity verification')}>
              <table className="data-table admin-table">
                <thead>
                  <tr>
                    <th scope="col">{t('Customer')}</th>
                    <th scope="col">{t('Type of ID')}</th>
                    <th scope="col">{t('Status')}</th>
                    <th scope="col">{t('Files')}</th>
                    <th scope="col">{t('Sent')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((i) => (
                    <tr key={i.id}>
                      <th scope="row">
                        <Link to={`/admin/verification/${encodeURIComponent(i.id)}`}>{i.customer.name || '—'}</Link>
                        <span className="small muted block">{i.customer.email}</span>
                      </th>
                      <td>{t(ID_DOCUMENT_LABEL[i.idType])}</td>
                      <td>
                        <StatusChip status={i.status} />
                      </td>
                      <td className="tabular">{i.fileCount}</td>
                      <td className="small tabular">{i.submittedAt ? formatDateTime(i.submittedAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPage={(p) => setParams({ ...(status === 'submitted' ? {} : { status }), page: String(p) })}
            />
          </>
        )
      ) : !error ? (
        <p className="muted">{t('Loading…')}</p>
      ) : null}
    </div>
  );
}

function DocumentView({ submissionId, file }: { submissionId: string; file: KycFileView }) {
  const { admin } = useServices();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let made: string | null = null;
    let cancelled = false;
    admin.kyc
      .file(submissionId, file.id)
      .then((c) => {
        if (cancelled) return;
        made = base64ObjectUrl(c.dataBase64, c.contentType);
        setUrl(made);
      })
      .catch((e: unknown) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [admin, submissionId, file.id]);
  const pdf = file.contentType === 'application/pdf';
  return (
    <figure className="kyc-doc">
      <figcaption>
        <strong>{t(KYC_FILE_LABEL[file.kind])}</strong>
        <span className="small muted block">
          {file.fileName} · {formatFileSize(file.sizeBytes)} · {formatDateTime(file.createdAt)}
        </span>
      </figcaption>
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : !url ? (
        <p className="muted small">{t('Loading…')}</p>
      ) : pdf ? (
        <a className="btn btn--secondary" href={url} target="_blank" rel="noreferrer">
          {t('Open the PDF')} <Icon name="external" width={14} height={14} />
        </a>
      ) : (
        <a href={url} target="_blank" rel="noreferrer" aria-label={t('Open full size')}>
          <img className="kyc-doc__img" src={url} alt={t(KYC_FILE_LABEL[file.kind])} />
        </a>
      )}
    </figure>
  );
}

const DECISIONS: { value: KycDecision; label: string; submit: string; danger?: boolean; hint: string }[] = [
  { value: 'approve', label: 'Approve', submit: 'Approve verification', hint: 'The customer can place exchanges.' },
  {
    value: 'needs_info',
    label: 'Ask for more information',
    submit: 'Send the request',
    hint: 'The customer sees this note and can replace files.',
  },
  { value: 'reject', label: 'Reject', submit: 'Reject verification', danger: true, hint: 'Final. The customer can’t place exchanges.' },
];

function DecisionPanel({ detail, onDone }: { detail: KycDetail; onDone(d: KycDetail): void }) {
  const { admin } = useServices();
  const [mode, setMode] = useState<KycDecision | null>(null);
  const current = DECISIONS.find((d) => d.value === mode);
  return (
    <section className="panel" aria-labelledby="kyc-decision-title">
      <div className="panel__head">
        <h2 id="kyc-decision-title">{t('Decision')}</h2>
      </div>
      <div className="panel__body stack">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {DECISIONS.map((d) => (
            <button
              key={d.value}
              type="button"
              className={`btn ${d.value === 'approve' ? '' : d.danger ? 'btn--danger' : 'btn--secondary'}`}
              aria-expanded={mode === d.value}
              onClick={() => setMode(mode === d.value ? null : d.value)}
            >
              {t(d.label)}
            </button>
          ))}
        </div>
        {current ? (
          <ReasonForm
            key={current.value}
            id="kyc-reason"
            label={current.value === 'needs_info' ? 'Note to the customer (also recorded in the audit log)' : undefined}
            submitLabel={current.submit}
            danger={current.danger}
            onCancel={() => setMode(null)}
            onSubmit={async (reason) => onDone(await admin.kyc.decide(detail.id, current.value, reason))}
          >
            <p className="small muted">{t(current.hint)}</p>
          </ReasonForm>
        ) : null}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{t(label)}</dt>
      <dd className="tabular">{children}</dd>
    </div>
  );
}

/** One verification: the customer’s profile next to their documents, and the decision. */
export function VerificationDetailPage() {
  const { id = '' } = useParams();
  const { admin } = useServices();
  const sandbox = useConfig().mode === 'sandbox';
  const { data, setData, error } = useLoad(() => admin.kyc.get(id), [id]);
  if (!data)
    return (
      <div className="stack stack--lg">
        <AdminHead title={t('Identity verification')} />
        <LoadError error={error} />
        {!error ? <p className="muted">{t('Loading…')}</p> : null}
      </div>
    );
  const c = data.customer;
  return (
    <div className="stack stack--lg">
      <p className="small">
        <Link to="/admin/verification">
          <Icon name="arrowLeft" width={14} height={14} /> {t('All verifications')}
        </Link>
      </p>
      <AdminHead title={c.name || '—'} lead={`${c.email} · ${t(ID_DOCUMENT_LABEL[data.idType])}`}>
        <StatusChip status={data.status} />
        {sandbox ? <MockBadge label={t('Test documents')} /> : null}
      </AdminHead>
      <div className="kyc-review">
        <section className="panel" aria-labelledby="kyc-customer-title">
          <div className="panel__head">
            <h2 id="kyc-customer-title">{t('Customer profile')}</h2>
          </div>
          <div className="panel__body">
            <dl className="dl">
              <Row label="Full legal name">{c.name || '—'}</Row>
              <Row label="Country of residence">
                {c.countryOfResidence ? countryName(c.countryOfResidence) : '—'}
                {c.stateOfResidence ? `, ${c.stateOfResidence}` : ''}
              </Row>
              <Row label="Phone">{c.phone ?? '—'}</Row>
              <Row label="Email">{c.email}</Row>
              <Row label="Account created">{formatDateTime(c.createdAt)}</Row>
              <Row label="Sent for review">{data.submittedAt ? formatDateTime(data.submittedAt) : '—'}</Row>
              {data.reviewedAt ? (
                <Row label="Reviewed">
                  {formatDateTime(data.reviewedAt)}
                  {data.reviewedBy ? ` · ${data.reviewedBy}` : ''}
                </Row>
              ) : null}
              {data.reason ? <Row label="Reason">{data.reason}</Row> : null}
            </dl>
            {data.history.length ? (
              <p className="small muted">
                {t('Earlier submissions: {0}', [data.history.map((h) => t(STATUS[h.status].label)).join(', ')])}
              </p>
            ) : null}
          </div>
        </section>
        <section className="panel" aria-labelledby="kyc-docs-title">
          <div className="panel__head">
            <h2 id="kyc-docs-title">{t('Documents')}</h2>
            <span className="small muted">
              <Icon name="lock" width={14} height={14} /> {t('Each view is recorded in the audit log')}
            </span>
          </div>
          <div className="panel__body kyc-docs">
            {data.files.map((f) => (
              <DocumentView key={f.id} submissionId={data.id} file={f} />
            ))}
          </div>
        </section>
      </div>
      {data.status === 'submitted' ? (
        <DecisionPanel detail={data} onDone={setData} />
      ) : (
        <Notice tone="neutral" title={t('Decided: {0}', [t(STATUS[data.status].label)])}>
          {data.status === 'needs_info' ? <p>{t('The customer can replace files and send them again.')}</p> : null}
        </Notice>
      )}
    </div>
  );
}
