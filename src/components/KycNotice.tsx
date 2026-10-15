import { Link } from 'react-router-dom';
import { MockBadge, Notice } from '@/components/ui';
import { useUser } from '@/state/auth';
import { useConfig } from '@/state/config';
import { t } from '@/i18n';

const KYC_COPY: Record<string, { tone: 'info' | 'warn' | 'danger'; title: string; body: string }> = {
  unverified: {
    tone: 'info',
    title: 'Verify your identity to confirm',
    body: 'Identity verification is required before an exchange (Service Rules, Section 8): a photo ID, a selfie and a proof of address. Additional documents may be requested for a transaction classified as high-risk.',
  },
  pending: {
    tone: 'info',
    title: 'Your documents are being reviewed',
    body: 'You can confirm the exchange once our team approves your verification. We will notify you when the review is finished.',
  },
  needs_info: {
    tone: 'warn',
    title: 'We need more information',
    body: 'Open your documents to see the reviewer’s note. You can confirm the exchange once verification is complete.',
  },
  rejected: {
    tone: 'danger',
    title: 'We can’t verify your identity',
    body: 'We can’t offer exchanges on this account. Contact support if you think this is a mistake.',
  },
};

/** Identity verification status and the link that moves it forward. Renders nothing once verified. */
export function KycNotice() {
  const config = useConfig();
  const user = useUser();
  if (!user) return null;
  const kyc = user.verification.status;
  const kycCopy = KYC_COPY[kyc];
  if (kyc === 'verified' || !kycCopy) return null;

  return (
    <Notice tone={kycCopy.tone} title={t(kycCopy.title)}>
      <p>{t(kycCopy.body)}</p>
      {config.mode === 'sandbox' && kyc === 'unverified' ? (
        <p className="small">
          {t('Sandbox: upload test images, not real documents. A reviewer decides in the CRM.')} <MockBadge />
        </p>
      ) : null}
      <div>
        {kyc === 'rejected' ? (
          <Link to="/support" className="btn btn--secondary">
            {t('Open support messages')}
          </Link>
        ) : (
          <Link to="/verification" className="btn btn--secondary">
            {kyc === 'unverified' ? t('Verify my identity') : kyc === 'needs_info' ? t('Update my documents') : t('View my documents')}
          </Link>
        )}
      </div>
    </Notice>
  );
}
