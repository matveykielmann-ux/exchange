import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { MockBadge, Notice, PageHeader, StatusBadge } from '@/components/ui';
import {
  acceptedFileTypes,
  ID_DOCUMENT_LABEL,
  ID_DOCUMENT_TYPES,
  isKycEditable,
  KYC_FILE_LABEL,
  KYC_FILE_MAX_BYTES,
  requiredKycFiles,
  type IdDocumentType,
  type KycFileKind,
} from '@/domain/identity';
import { errorMessage, isNotConfigured } from '@/lib/errors';
import { base64ObjectUrl, formatFileSize, readBase64 } from '@/lib/files';
import { formatDateTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import type { KycFileView, KycState, KycStatus } from '@/services/types';
import { useUser } from '@/state/auth';
import { useConfig } from '@/state/config';
import { useServices } from '@/state/services';
import { t } from '@/i18n';

const STATUS: Record<KycStatus, { label: string; tone: 'neutral' | 'success' | 'info' | 'warn' | 'danger' }> = {
  unverified: { label: 'Not verified', tone: 'neutral' },
  pending: { label: 'In review', tone: 'info' },
  verified: { label: 'Verified', tone: 'success' },
  needs_info: { label: 'More information needed', tone: 'warn' },
  rejected: { label: 'Not approved', tone: 'danger' },
};

const HINT: Record<KycFileKind, string> = {
  id_front: 'The side with your photo. All four corners visible, no glare, every word readable.',
  id_back: 'The other side of the same card, including the barcode.',
  selfie: 'A clear photo of your face in good light, without sunglasses or a hat. JPEG or PNG.',
  proof_of_address: 'A recent utility bill, bank or card statement, or government letter showing your full name and residential address.',
};

function FileSlot({
  kind,
  file,
  disabled,
  onUpload,
}: {
  kind: KycFileKind;
  file: KycFileView | undefined;
  disabled: boolean;
  onUpload(kind: KycFileKind, f: File): Promise<void>;
}) {
  const { account } = useServices();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const types = acceptedFileTypes(kind);
  const inputId = `kyc-${kind}`;

  useEffect(() => () => (preview ? URL.revokeObjectURL(preview.url) : undefined), [preview]);

  async function choose(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!(types as readonly string[]).includes(f.type))
      return setError(kind === 'selfie' ? t('Upload a JPEG or PNG file.') : t('Upload a JPEG, PNG or PDF file.'));
    if (f.size > KYC_FILE_MAX_BYTES) return setError(t('The file is larger than 8 MB. Use a smaller photo or scan.'));
    setBusy(true);
    try {
      await onUpload(kind, f);
      setPreview({ url: URL.createObjectURL(f), type: f.type });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function view() {
    if (!file) return;
    setError(null);
    try {
      const c = await account.kyc.file(file.id);
      setPreview({ url: base64ObjectUrl(c.dataBase64, c.contentType), type: c.contentType });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <li className="kyc-slot" data-done={file ? 'true' : undefined}>
      <div className="kyc-slot__head">
        <span className="kyc-slot__icon" aria-hidden="true">
          <Icon name={file ? 'check' : kind === 'selfie' ? 'user' : kind === 'proof_of_address' ? 'file' : 'card'} width={18} height={18} />
        </span>
        <div>
          <h3 className="kyc-slot__title">{t(KYC_FILE_LABEL[kind])}</h3>
          <p className="small muted">{t(HINT[kind])}</p>
        </div>
      </div>
      {preview ? (
        preview.type.startsWith('image/') ? (
          <img className="kyc-slot__preview" src={preview.url} alt={t(KYC_FILE_LABEL[kind])} />
        ) : (
          <a className="small" href={preview.url} target="_blank" rel="noreferrer">
            {t('Open the PDF')} <Icon name="external" width={14} height={14} />
          </a>
        )
      ) : null}
      {file ? (
        <p className="small kyc-slot__file">
          <strong>{file.fileName}</strong>{' '}
          <span className="muted tabular">
            · {formatFileSize(file.sizeBytes)} · {formatDateTime(file.createdAt)}
          </span>
          {!preview ? (
            <>
              {' '}
              <button type="button" className="link-button" onClick={view}>
                {t('View')}
              </button>
            </>
          ) : null}
        </p>
      ) : null}
      {!disabled ? (
        <div className="field" data-invalid={error ? 'true' : undefined}>
          <label className="field__label" htmlFor={inputId}>
            {file ? t('Replace the file') : t('Choose a file')}{' '}
            <span className="muted small">({kind === 'selfie' ? 'JPEG, PNG' : 'JPEG, PNG, PDF'} · 8 MB)</span>
          </label>
          <input
            ref={inputRef}
            id={inputId}
            className="input"
            type="file"
            accept={types.join(',')}
            disabled={busy}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            onChange={(e) => void choose(e.target.files?.[0])}
          />
          {busy ? <p className="small muted">{t('Uploading…')}</p> : null}
        </div>
      ) : null}
      {error ? (
        <p className="field__error" id={`${inputId}-error`} role="alert">
          <Icon name="alert" /> {error}
        </p>
      ) : null}
    </li>
  );
}

/** Identity verification by documents (Service Rules 8.1): photo ID, selfie and proof of address, reviewed by our team. */
export function VerificationPage() {
  useDocumentTitle('Identity verification');
  const { account, live } = useServices();
  const config = useConfig();
  const user = useUser();
  const [state, setState] = useState<KycState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Shown checked at once; the server confirms the choice.
  const [chosen, setChosen] = useState<IdDocumentType | null>(null);

  const load = useCallback(() => {
    account.kyc
      .get()
      .then(setState)
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [account]);
  useEffect(load, [load, user?.verification.status]);
  // A reviewer's decision arrives as an account notification.
  useEffect(() => live.subscribe((e) => (e.type === 'notification.created' ? load() : undefined)), [live, load]);

  async function run(fn: () => Promise<KycState>) {
    setError(null);
    try {
      setState(await fn());
    } catch (e) {
      setError(isNotConfigured(e) ? t('Document upload is not available yet: document storage is not connected.') : errorMessage(e));
      throw e;
    }
  }

  if (!state)
    return (
      <>
        <PageHeader eyebrow={t('Account')} title={t('Identity verification')} />
        <div className="container">
          {error ? <Notice tone="danger" title={error} role="alert" /> : <p className="muted">{t('Loading…')}</p>}
        </div>
      </>
    );

  const s = state.submission;
  const editable = state.status !== 'verified' && state.status !== 'rejected' && (!s || isKycEditable(s.status));
  const idType: IdDocumentType | null = s?.idType ?? null;
  const files = new Map(s?.files.map((f) => [f.kind, f]) ?? []);
  const required = idType ? requiredKycFiles(idType) : [];
  const k = STATUS[state.status];

  return (
    <>
      <PageHeader
        eyebrow={t('Account')}
        title={t('Identity verification')}
        lead={t(
          'Service Rules, clause 8.1: verification may include an identification document (passport, ID card, driver’s license) and a selfie for identity confirmation. We also ask for a proof of address.',
        )}
      >
        <div className="row">
          <StatusBadge tone={k.tone}>{t(k.label)}</StatusBadge>
          {config.mode === 'sandbox' ? <MockBadge label={t('Sandbox account')} /> : null}
        </div>
      </PageHeader>
      <div className="container stack stack--lg kyc-page">
        {config.mode === 'sandbox' ? (
          <Notice tone="neutral" title={t('Sandbox: use test images, not real documents')}>
            <p>
              {t(
                'Files are checked and kept encrypted in the sandbox database. A reviewer approves or rejects them in the CRM. A name containing “Sanctioned” fails screening.',
              )}{' '}
              <MockBadge />
            </p>
          </Notice>
        ) : null}

        {state.status === 'verified' ? (
          <Notice tone="info" title={t('Your identity is verified')}>
            <p>{t('You can place exchanges up to the per-order limit.')}</p>
            <div>
              <Link className="btn" to="/exchange">
                {t('Start an exchange')}
              </Link>
            </div>
          </Notice>
        ) : state.status === 'rejected' ? (
          <Notice tone="danger" title={t('We can’t verify your identity')}>
            <p>{t('We can’t offer exchanges on this account. Contact support if you think this is a mistake.')}</p>
            <div>
              <Link className="btn btn--secondary" to="/support">
                {t('Open support messages')}
              </Link>
            </div>
          </Notice>
        ) : s?.status === 'submitted' ? (
          <Notice tone="info" title={t('Your documents are being reviewed')} role="status">
            <p>
              {t('Sent {0}. We will notify you by email and in your account when the review is finished.', [
                s.submittedAt ? formatDateTime(s.submittedAt) : '',
              ])}
            </p>
          </Notice>
        ) : s?.status === 'needs_info' ? (
          <Notice tone="warn" title={t('We need more information')} role="status">
            {s.reason ? (
              <p>
                <strong>{t('Reviewer’s note:')}</strong> {s.reason}
              </p>
            ) : null}
            <p>{t('Replace the files the note mentions, then send them for review again.')}</p>
          </Notice>
        ) : null}

        {editable ? (
          <section className="panel" aria-labelledby="kyc-type-title">
            <div className="panel__head">
              <h2 id="kyc-type-title">{t('1. Choose your photo ID')}</h2>
            </div>
            <div className="panel__body">
              <fieldset className="option-list kyc-types">
                <legend className="field__label">{t('Type of ID')}</legend>
                {ID_DOCUMENT_TYPES.map((type) => (
                  <label className="option" key={type} htmlFor={`idtype-${type}`}>
                    <input
                      id={`idtype-${type}`}
                      type="radio"
                      name="idType"
                      checked={(chosen ?? idType) === type}
                      onChange={() => {
                        setChosen(type);
                        void run(() => account.kyc.setIdType(type))
                          .catch(() => undefined)
                          .finally(() => setChosen(null));
                      }}
                    />
                    <span>
                      <span className="option__title">{t(ID_DOCUMENT_LABEL[type])}</span>
                      <span className="option__meta" style={{ display: 'block' }}>
                        {type === 'passport' ? t('The photo page') : t('Front and back')}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            </div>
          </section>
        ) : null}

        {idType ? (
          <section className="panel" aria-labelledby="kyc-files-title">
            <div className="panel__head">
              <h2 id="kyc-files-title">{editable ? t('2. Upload your documents') : t('Your documents')}</h2>
              <span className="small muted">{t(ID_DOCUMENT_LABEL[idType])}</span>
            </div>
            <div className="panel__body stack">
              <ul className="kyc-slots">
                {required.map((kind) => (
                  <FileSlot
                    key={kind}
                    kind={kind}
                    file={files.get(kind)}
                    disabled={!editable}
                    onUpload={async (kd, f) => {
                      const dataBase64 = await readBase64(f);
                      await run(() => account.kyc.upload({ kind: kd, fileName: f.name, contentType: f.type, dataBase64 }));
                    }}
                  />
                ))}
              </ul>
              <p className="small muted">
                <Icon name="lock" width={14} height={14} />{' '}
                {t('Files are encrypted when stored. Only you and our verification reviewers can open them.')}
              </p>
              {editable && s ? (
                <div className="row">
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || s.missing.length > 0}
                    onClick={async () => {
                      setBusy(true);
                      await run(() => account.kyc.submit()).catch(() => undefined);
                      setBusy(false);
                    }}
                  >
                    {busy ? t('Sending…') : t('Send for review')}
                  </button>
                  {s.missing.length ? (
                    <span className="small muted">{t('Still needed: {0}', [s.missing.map((m) => t(KYC_FILE_LABEL[m])).join(', ')])}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
        {error ? <Notice tone={error.includes('not available yet') ? 'warn' : 'danger'} title={error} role="alert" /> : null}
      </div>
    </>
  );
}
