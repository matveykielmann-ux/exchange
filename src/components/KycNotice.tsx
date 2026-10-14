import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MockBadge, Notice } from '@/components/ui';
import { errorMessage, isNotConfigured } from '@/lib/errors';
import { useUser } from '@/state/auth';
import { useConfig } from '@/state/config';
import { useServices } from '@/state/services';
import { t } from '@/i18n';

const KYC_COPY: Record<string, { tone: 'info' | 'warn' | 'danger'; title: string; body: string }> = {
  unverified: {
    tone: 'info',
    title: 'Verify your identity to confirm',
    body: 'Identity verification is required before an exchange (Service Rules, Section 8). It takes a few minutes. Additional documents may be requested for a transaction classified as high-risk.',
  },
  pending: {
    tone: 'info',
    title: 'Verification in progress',
    body: 'We will update this page when the result arrives. You can keep this page open.',
  },
  needs_info: {
    tone: 'warn',
    title: 'We need more information',
    body: 'Our team will contact you in your support messages. You can confirm the exchange once verification is complete.',
  },
  rejected: {
    tone: 'danger',
    title: 'We can’t verify your identity',
    body: 'We can’t offer exchanges on this account. Contact support if you think this is a mistake.',
  },
};

/** Identity verification status and the action that moves it forward. Renders nothing once verified. */
export function KycNotice() {
  const services = useServices();
  const config = useConfig();
  const user = useUser();
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  if (!user) return null;
  const kyc = user.verification.status;
  const kycCopy = KYC_COPY[kyc];
  if (kyc === 'verified' || !kycCopy) return null;

  async function verify() {
    setVerifying(true);
    setVerifyError(null);
    try {
      const r = await services.account.startVerification();
      if (r.hostedUrl) window.location.assign(r.hostedUrl);
    } catch (e) {
      setVerifyError(
        isNotConfigured(e) ? t('Identity verification is not available yet: the provider is not connected.') : errorMessage(e),
      );
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Notice tone={kycCopy.tone} title={t(kycCopy.title)}>
      <p>{t(kycCopy.body)}</p>
      {config.mode === 'sandbox' && kyc === 'unverified' ? (
        <p className="small">
          {t(
            'Sandbox: verification is decided by test rules. A name containing “Review” needs more information, “Reject” is rejected, and any other name is approved.',
          )}{' '}
          <MockBadge />
        </p>
      ) : null}
      {kyc === 'unverified' ? (
        <div>
          <button type="button" className="btn btn--secondary" disabled={verifying} onClick={verify}>
            {verifying ? t('Starting…') : t('Verify my identity')}
          </button>
        </div>
      ) : kyc === 'needs_info' || kyc === 'rejected' ? (
        <div>
          <Link to="/support" className="btn btn--secondary">
            {t('Open support messages')}
          </Link>
        </div>
      ) : null}
      {verifyError ? (
        <p className="field__error" role="alert">
          {verifyError}
        </p>
      ) : null}
    </Notice>
  );
}
