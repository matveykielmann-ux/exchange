/**
 * Identity verification by documents (Service Rules 8.1): the customer uploads
 * a photo ID (driver’s license, state ID or passport), a selfie and a proof of
 * address, then sends them for review. A reviewer or admin approves, asks for
 * more information or rejects in the CRM, always with a recorded reason.
 *
 * Files are checked like order documents (magic bytes, size, clean name) and
 * kept encrypted at rest in SQLite (`content_enc`, AES-256-GCM with
 * DATA_ENCRYPTION_KEY). Only the customer who uploaded a file and
 * reviewer-level staff can open it; support staff cannot. Every staff view of
 * a file is written to the audit log. Order attachments use FILES_DIR instead
 * (see `documents.ts` / `fileStore.ts`).
 */
import { createHash } from 'node:crypto';
import {
  acceptedFileTypes,
  isKycEditable,
  missingKycFiles,
  KYC_FILE_MAX_BYTES,
  type IdDocumentType,
  type KycDecision,
  type KycFileKind,
  type KycSubmissionStatus,
} from '@/domain/identity';
import type { Actor, AppContext } from '../context';
import { ApiError, badRequest, conflict, notConfigured, notFound } from '../http/errors';
import { newId } from '../lib/clock';
import { decrypt, encrypt } from '../lib/crypto';
import { isUsable } from '../providers/registry';
import { audit } from './audit';
import { getProfile } from './customers';
import { cleanName, decodeUpload, type DocumentType } from './documents';
import { maskEmail } from './format';
import { notify } from './notifications';

interface SubmissionRow {
  id: string;
  user_id: string;
  id_type: IdDocumentType;
  status: KycSubmissionStatus;
  decision_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: number | null;
  submitted_at: number | null;
  created_at: number;
  updated_at: number;
}

interface FileRow {
  id: string;
  submission_id: string;
  user_id: string;
  kind: KycFileKind;
  file_name: string;
  content_type: DocumentType;
  size_bytes: number;
  sha256: string;
  content_enc: string;
  created_at: number;
}

const FILE_META = 'id, submission_id, user_id, kind, file_name, content_type, size_bytes, sha256, created_at';

function fileView(f: Omit<FileRow, 'content_enc'>) {
  return { id: f.id, kind: f.kind, fileName: f.file_name, contentType: f.content_type, sizeBytes: f.size_bytes, createdAt: f.created_at };
}

function files(ctx: AppContext, submissionId: string) {
  return ctx.db.all<Omit<FileRow, 'content_enc'>>(`SELECT ${FILE_META} FROM kyc_files WHERE submission_id = ? ORDER BY created_at`, [
    submissionId,
  ]);
}

function latest(ctx: AppContext, userId: string): SubmissionRow | null {
  return (
    ctx.db.get<SubmissionRow>('SELECT * FROM kyc_submissions WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1', [userId]) ??
    null
  );
}

function submissionView(ctx: AppContext, s: SubmissionRow, forCustomer = false) {
  const list = files(ctx, s.id);
  return {
    id: s.id,
    idType: s.id_type,
    status: s.status,
    // Customers see the reviewer's note only when it asks them for something; screening reasons stay internal (Rules 8.2).
    reason: !forCustomer || s.status === 'needs_info' ? s.decision_reason : null,
    submittedAt: s.submitted_at,
    reviewedAt: s.reviewed_at,
    files: list.map(fileView),
    missing: missingKycFiles(
      s.id_type,
      list.map((f) => f.kind),
    ),
  };
}

/** The customer’s verification status and their latest submission. */
export function customerKyc(ctx: AppContext, userId: string) {
  const p = getProfile(ctx, userId);
  const s = latest(ctx, userId);
  return { status: p.kyc_status, submission: s ? submissionView(ctx, s, true) : null };
}

/** The submission the customer can still change, created on first use. */
function openSubmission(ctx: AppContext, actor: Actor, userId: string, idType?: IdDocumentType): SubmissionRow {
  const p = getProfile(ctx, userId);
  if (p.kyc_status === 'verified') throw conflict('Your identity is already verified.');
  if (p.kyc_status === 'rejected')
    throw conflict('We could not verify your identity. Contact support if you think this is a mistake.', 'kyc_rejected');
  const s = latest(ctx, userId);
  if (s && s.status === 'submitted')
    throw conflict('Your documents are being reviewed. You can change them if we ask for more information.');
  if (s && isKycEditable(s.status)) return s;
  if (!idType) throw badRequest('Choose the type of ID first.', { field: 'idType' });
  const id = newId('kyc');
  const now = ctx.clock.now();
  ctx.db.tx(() => {
    ctx.db.run("INSERT INTO kyc_submissions (id, user_id, id_type, status, created_at, updated_at) VALUES (?, ?, ?, 'draft', ?, ?)", [
      id,
      userId,
      idType,
      now,
      now,
    ]);
    audit(ctx, actor, { action: 'kyc.submission_created', targetType: 'user', targetId: userId, data: { submissionId: id, idType } });
  });
  return latest(ctx, userId)!;
}

export function setIdType(ctx: AppContext, actor: Actor, userId: string, idType: IdDocumentType) {
  const s = openSubmission(ctx, actor, userId, idType);
  if (s.id_type !== idType) {
    ctx.db.tx(() => {
      ctx.db.run('UPDATE kyc_submissions SET id_type = ?, updated_at = ? WHERE id = ?', [idType, ctx.clock.now(), s.id]);
      // A passport has no back side: drop a back photo uploaded for a card ID.
      if (idType === 'passport') ctx.db.run("DELETE FROM kyc_files WHERE submission_id = ? AND kind = 'id_back'", [s.id]);
      audit(ctx, actor, { action: 'kyc.id_type_changed', targetType: 'user', targetId: userId, data: { submissionId: s.id, idType } });
    });
  }
  return customerKyc(ctx, userId);
}

export function uploadKycFile(
  ctx: AppContext,
  actor: Actor,
  userId: string,
  input: { kind: KycFileKind; fileName: string; contentType: DocumentType; dataBase64: string },
) {
  const s = openSubmission(ctx, actor, userId);
  if (input.kind === 'id_back' && s.id_type === 'passport') throw badRequest('A passport needs only the photo page.', { field: 'kind' });
  const { bytes, detected } = decodeUpload(input, { maxBytes: KYC_FILE_MAX_BYTES, allowed: acceptedFileTypes(input.kind) });
  const id = newId('kycf');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const now = ctx.clock.now();
  ctx.db.tx(() => {
    // One file per kind: a new upload replaces the previous one.
    ctx.db.run('DELETE FROM kyc_files WHERE submission_id = ? AND kind = ?', [s.id, input.kind]);
    ctx.db.run(
      `INSERT INTO kyc_files (id, submission_id, user_id, kind, file_name, content_type, size_bytes, sha256, content_enc, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        s.id,
        userId,
        input.kind,
        cleanName(input.fileName),
        detected,
        bytes.length,
        sha256,
        encrypt(ctx.config.dataEncryptionKey, bytes.toString('base64')),
        now,
      ],
    );
    ctx.db.run('UPDATE kyc_submissions SET updated_at = ? WHERE id = ?', [now, s.id]);
    audit(ctx, actor, {
      action: 'kyc.file_uploaded',
      targetType: 'user',
      targetId: userId,
      data: { submissionId: s.id, fileId: id, kind: input.kind, contentType: detected, sizeBytes: bytes.length, sha256 },
    });
  });
  return customerKyc(ctx, userId);
}

/** Sends a complete submission for review. Sanctions screening runs first and can reject it outright. */
export async function submitKyc(ctx: AppContext, actor: Actor, userId: string) {
  const s = openSubmission(ctx, actor, userId);
  const missing = missingKycFiles(
    s.id_type,
    files(ctx, s.id).map((f) => f.kind),
  );
  if (missing.length) throw badRequest('Upload every document before you send them for review.', { field: 'files', missing });
  const p = getProfile(ctx, userId);
  const email = ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [userId])!.email;
  if (!isUsable(ctx.providers.screening.info())) throw notConfigured('Sanctions screening');
  const screen = await ctx.providers.screening.screenCustomer({ fullName: p.full_name, email, stateOfResidence: p.state_of_residence });
  const now = ctx.clock.now();
  ctx.db.tx(() => {
    ctx.db.run("UPDATE kyc_submissions SET status = 'submitted', submitted_at = ?, decision_reason = NULL, updated_at = ? WHERE id = ?", [
      now,
      now,
      s.id,
    ]);
    ctx.db.run("UPDATE customer_profiles SET kyc_status = 'pending', updated_at = ? WHERE user_id = ?", [now, userId]);
    audit(ctx, actor, {
      action: 'kyc.submitted',
      targetType: 'user',
      targetId: userId,
      data: { submissionId: s.id, idType: s.id_type, screening: screen.result },
    });
  });
  if (screen.result === 'blocked')
    decide(ctx, { type: 'provider', id: 'screening', role: null, ip: null }, s.id, 'reject', screen.note || 'Sanctions screening match.');
  return customerKyc(ctx, userId);
}

function readFile(ctx: AppContext, f: FileRow) {
  return {
    ...fileView(f),
    dataBase64: decrypt(ctx.config.dataEncryptionKey, f.content_enc),
  };
}

/** A customer can open only their own files. */
export function customerFile(ctx: AppContext, userId: string, fileId: string) {
  const f = ctx.db.get<FileRow>('SELECT * FROM kyc_files WHERE id = ? AND user_id = ?', [fileId, userId]);
  if (!f) throw notFound('File not found.');
  return readFile(ctx, f);
}

/* ---------- Staff (reviewer, admin, owner) ---------- */

export type KycQueueFilter = 'submitted' | 'needs_info' | 'approved' | 'rejected' | 'all';

export function kycQueue(ctx: AppContext, q: { status: KycQueueFilter; page: number; pageSize: number }) {
  const where = q.status === 'all' ? "s.status != 'draft'" : 's.status = ?';
  const params = q.status === 'all' ? [] : [q.status];
  const total = ctx.db.get<{ n: number }>(`SELECT count(*) AS n FROM kyc_submissions s WHERE ${where}`, params)!.n;
  const rows = ctx.db.all<SubmissionRow & { email: string; full_name: string; n: number }>(
    `SELECT s.*, u.email, p.full_name, (SELECT count(*) FROM kyc_files f WHERE f.submission_id = s.id) AS n
     FROM kyc_submissions s JOIN users u ON u.id = s.user_id JOIN customer_profiles p ON p.user_id = s.user_id
     WHERE ${where} ORDER BY s.submitted_at ${q.status === 'submitted' ? 'ASC' : 'DESC'}, s.id LIMIT ? OFFSET ?`,
    [...params, q.pageSize, (q.page - 1) * q.pageSize],
  );
  return {
    items: rows.map((r) => ({
      id: r.id,
      customer: { id: r.user_id, name: r.full_name, email: maskEmail(r.email) },
      idType: r.id_type,
      status: r.status,
      fileCount: r.n,
      submittedAt: r.submitted_at,
      reviewedAt: r.reviewed_at,
    })),
    page: q.page,
    pageSize: q.pageSize,
    total,
  };
}

function staffSubmission(ctx: AppContext, id: string): SubmissionRow {
  const s = ctx.db.get<SubmissionRow>("SELECT * FROM kyc_submissions WHERE id = ? AND status != 'draft'", [id]);
  if (!s) throw notFound('Verification not found.');
  return s;
}

export function kycDetail(ctx: AppContext, id: string) {
  const s = staffSubmission(ctx, id);
  const p = getProfile(ctx, s.user_id);
  const u = ctx.db.get<{ email: string; created_at: number }>('SELECT email, created_at FROM users WHERE id = ?', [s.user_id])!;
  const reviewer = s.reviewed_by
    ? (ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [s.reviewed_by])?.email ?? null)
    : null;
  const history = ctx.db
    .all<{
      id: string;
      status: KycSubmissionStatus;
      created_at: number;
    }>("SELECT id, status, created_at FROM kyc_submissions WHERE user_id = ? AND id != ? AND status != 'draft' ORDER BY created_at DESC", [
      s.user_id,
      s.id,
    ])
    .map((h) => ({ id: h.id, status: h.status, createdAt: h.created_at }));
  return {
    ...submissionView(ctx, s),
    reviewedBy: reviewer,
    customer: {
      id: s.user_id,
      name: p.full_name,
      email: maskEmail(u.email),
      phone: p.phone,
      countryOfResidence: p.country_of_residence,
      stateOfResidence: p.state_of_residence,
      kycStatus: p.kyc_status,
      createdAt: u.created_at,
    },
    history,
  };
}

export function staffFile(ctx: AppContext, actor: Actor, submissionId: string, fileId: string) {
  staffSubmission(ctx, submissionId);
  const f = ctx.db.get<FileRow>('SELECT * FROM kyc_files WHERE id = ? AND submission_id = ?', [fileId, submissionId]);
  if (!f) throw notFound('File not found.');
  audit(ctx, actor, { action: 'kyc.file_viewed', targetType: 'user', targetId: f.user_id, data: { submissionId, fileId, kind: f.kind } });
  return readFile(ctx, f);
}

const DECISION: Record<KycDecision, { submission: KycSubmissionStatus; profile: 'verified' | 'needs_info' | 'rejected' }> = {
  approve: { submission: 'approved', profile: 'verified' },
  needs_info: { submission: 'needs_info', profile: 'needs_info' },
  reject: { submission: 'rejected', profile: 'rejected' },
};

export function decide(ctx: AppContext, actor: Actor, id: string, decision: KycDecision, reason: string) {
  const s = staffSubmission(ctx, id);
  if (s.status !== 'submitted') throw conflict('This verification has already been decided.', 'invalid_transition');
  if (actor.id && actor.id === s.user_id) throw new ApiError(403, 'forbidden', 'You cannot review your own verification.');
  const to = DECISION[decision];
  const now = ctx.clock.now();
  ctx.db.tx(() => {
    ctx.db.run(
      'UPDATE kyc_submissions SET status = ?, decision_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?',
      [to.submission, reason, actor.type === 'operator' ? actor.id : null, now, now, s.id],
    );
    ctx.db.run('UPDATE customer_profiles SET kyc_status = ?, kyc_level = ?, updated_at = ? WHERE user_id = ?', [
      to.profile,
      decision === 'approve' ? 'basic' : 'none',
      now,
      s.user_id,
    ]);
    audit(ctx, actor, {
      action: `kyc.${decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'needs_info'}`,
      targetType: 'user',
      targetId: s.user_id,
      reason,
      data: { submissionId: s.id },
    });
    const email = ctx.db.get<{ email: string }>('SELECT email FROM users WHERE id = ?', [s.user_id])!.email;
    notify(ctx, { userId: s.user_id, to: email, template: 'verification_updated', vars: { status: to.profile.replace('_', ' ') } });
  });
  return kycDetail(ctx, s.id);
}
