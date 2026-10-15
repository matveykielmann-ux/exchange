/** Identity-verification tiers and the rules that depend on them. Shared by UI and services. */
export type VerificationLevel = 'unverified' | 'verified' | 'enhanced';

/** Online exchanges need at least basic verification. */
export function canConfirmExchange(level: VerificationLevel): boolean {
  return level !== 'unverified';
}

/* ---------- Document verification (Service Rules 8.1) ---------- */

/** The photo IDs a customer can verify with. */
export const ID_DOCUMENT_TYPES = ['drivers_license', 'state_id', 'passport'] as const;
export type IdDocumentType = (typeof ID_DOCUMENT_TYPES)[number];
export const ID_DOCUMENT_LABEL: Record<IdDocumentType, string> = {
  drivers_license: 'Driver’s license',
  state_id: 'State ID',
  passport: 'Passport',
};

/** The files of a verification: both sides of a card ID (one page for a passport), a selfie and a proof of address. */
export const KYC_FILE_KINDS = ['id_front', 'id_back', 'selfie', 'proof_of_address'] as const;
export type KycFileKind = (typeof KYC_FILE_KINDS)[number];
export const KYC_FILE_LABEL: Record<KycFileKind, string> = {
  id_front: 'Front of the ID',
  id_back: 'Back of the ID',
  selfie: 'Selfie',
  proof_of_address: 'Proof of address',
};

export const KYC_FILE_MAX_BYTES = 8 * 1024 * 1024;
export const KYC_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
export type KycFileType = (typeof KYC_FILE_TYPES)[number];

/** A selfie must be a photo; documents may also be a PDF scan. */
export function acceptedFileTypes(kind: KycFileKind): readonly KycFileType[] {
  return kind === 'selfie' ? ['image/jpeg', 'image/png'] : KYC_FILE_TYPES;
}

/** A passport has one photo page; a driver’s license or state ID needs both sides. */
export function requiredKycFiles(type: IdDocumentType): KycFileKind[] {
  return type === 'passport' ? ['id_front', 'selfie', 'proof_of_address'] : ['id_front', 'id_back', 'selfie', 'proof_of_address'];
}

export function missingKycFiles(type: IdDocumentType, uploaded: readonly KycFileKind[]): KycFileKind[] {
  return requiredKycFiles(type).filter((k) => !uploaded.includes(k));
}

/** Review states of one submission. `needs_info` reopens it for the customer to replace files and send again. */
export type KycSubmissionStatus = 'draft' | 'submitted' | 'approved' | 'needs_info' | 'rejected';

/** The customer can change files while the submission is with them, not while it is with a reviewer or decided. */
export const isKycEditable = (s: KycSubmissionStatus) => s === 'draft' || s === 'needs_info';

export type KycDecision = 'approve' | 'needs_info' | 'reject';
