/**
 * Accounts, sessions, second factor (TOTP), password reset.
 *
 * - Passwords: scrypt; minimum 8 characters; never logged.
 * - Sessions: 256-bit random token in an httpOnly SameSite=Lax cookie; only
 *   an HMAC of it is stored. Fixed lifetime; revoked on password change/reset.
 * - CSRF: a per-session token, sent back in the X-CSRF-Token header (see router).
 * - Brute force: per-IP route limits plus per-account lockout after 5 failures.
 */
import { validateEmail, validatePassword } from '@/domain/validation';
import { residenceError } from '@/domain/residence';
import { BRAND } from '@/config/brand';
import { LEGAL_DOCUMENTS } from '@/content/legal';
import type { Actor, AppContext } from '../context';
import { ApiError, badRequest, conflict } from '../http/errors';
import type { AuthContext, Role } from '../http/router';
import { newId } from '../lib/clock';
import {
  decrypt,
  DUMMY_PASSWORD_HASH,
  encrypt,
  hashPassword,
  hmac,
  newTotpSecret,
  randomToken,
  verifyPassword,
  verifyTotp,
} from '../lib/crypto';
import { audit } from './audit';
import { notify } from './notifications';

export const SESSION_COOKIE = 'arcvale_session';
export const CSRF_COOKIE = 'arcvale_csrf';
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MS = 15 * 60_000;
const CHALLENGE_TTL_MS = 5 * 60_000;
const RESET_TTL_MS = 30 * 60_000;

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: Role;
  status: 'active' | 'disabled';
  totp_secret_enc: string | null;
  totp_enabled: number;
  failed_logins: number;
  locked_until: number | null;
  created_at: number;
  updated_at: number;
}

export interface SessionGrant {
  token: string;
  csrfToken: string;
  expiresAt: number;
}

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

const sessionId = (ctx: AppContext, token: string) => hmac(ctx.config.sessionSecret, `session:${token}`);

export function sessionCookies(ctx: AppContext, grant: SessionGrant | null): string[] {
  // Host-only cookies (no Domain=): customer sessions stay on PUBLIC_ORIGIN;
  // staff sessions on CRM_ORIGIN are never sent to the customer site.
  const secure = ctx.config.allowedOrigins.some((o) => o.startsWith('https://')) ? '; Secure' : '';
  if (!grant)
    return [
      `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
      `${CSRF_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0${secure}`,
    ];
  const maxAge = Math.max(0, Math.floor((grant.expiresAt - ctx.clock.now()) / 1000));
  return [
    `${SESSION_COOKIE}=${grant.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`,
    `${CSRF_COOKIE}=${grant.csrfToken}; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`,
  ];
}

export function createSession(
  ctx: AppContext,
  userId: string,
  mfaVerified: boolean,
  meta: { ip: string | null; userAgent: string | null },
): SessionGrant {
  const token = randomToken();
  const csrfToken = randomToken(24);
  const now = ctx.clock.now();
  const expiresAt = now + ctx.config.sessionTtlMs;
  ctx.db.run(
    'INSERT INTO sessions (id, user_id, csrf_token, mfa_verified, created_at, last_seen_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [sessionId(ctx, token), userId, csrfToken, mfaVerified ? 1 : 0, now, now, expiresAt, meta.ip, meta.userAgent],
  );
  return { token, csrfToken, expiresAt };
}

export function resolveSession(ctx: AppContext, token: string | undefined): AuthContext | null {
  if (!token || token.length > 128) return null;
  const id = sessionId(ctx, token);
  const row = ctx.db.get<{
    id: string;
    user_id: string;
    csrf_token: string;
    mfa_verified: number;
    expires_at: number;
    last_seen_at: number;
    email: string;
    role: Role;
    status: string;
    totp_enabled: number;
  }>(
    `SELECT s.id, s.user_id, s.csrf_token, s.mfa_verified, s.expires_at, s.last_seen_at, u.email, u.role, u.status, u.totp_enabled
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    [id],
  );
  const now = ctx.clock.now();
  if (!row) return null;
  if (row.expires_at <= now || row.status !== 'active') {
    ctx.db.run('DELETE FROM sessions WHERE id = ?', [id]);
    return null;
  }
  if (now - row.last_seen_at > 60_000) ctx.db.run('UPDATE sessions SET last_seen_at = ? WHERE id = ?', [now, id]);
  return {
    userId: row.user_id,
    email: row.email,
    role: row.role,
    sessionId: row.id,
    csrfToken: row.csrf_token,
    mfaVerified: row.mfa_verified === 1,
    totpEnabled: row.totp_enabled === 1,
  };
}

function currentSignupDocs() {
  return LEGAL_DOCUMENTS.filter((d) => d.acceptance === 'signup').map((d) => ({ slug: d.slug, version: d.version }));
}

/** Throws unless every document required for `context` is accepted at its current version. */
export function requireAcceptance(
  accepted: { slug: string; version: string }[],
  context: 'signup' | 'order',
): { slug: string; version: string }[] {
  const required = LEGAL_DOCUMENTS.filter((d) => d.acceptance === context);
  const missing = required.filter((d) => !accepted.some((a) => a.slug === d.slug && a.version === d.version));
  if (missing.length)
    throw new ApiError(422, 'acceptance_required', `Review and accept: ${missing.map((d) => d.title).join(', ')}.`, {
      documents: missing.map((d) => ({ slug: d.slug, version: d.version })),
    });
  return required.map((d) => ({ slug: d.slug, version: d.version }));
}

export function recordAcceptances(
  ctx: AppContext,
  userId: string,
  docs: { slug: string; version: string }[],
  context: 'signup' | 'order' | 'reacceptance',
  meta: { ip: string | null; orderId?: string },
) {
  for (const d of docs)
    ctx.db.run(
      'INSERT INTO legal_acceptances (id, user_id, document_slug, document_version, context, order_id, ip, accepted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [newId('acc'), userId, d.slug, d.version, context, meta.orderId ?? null, meta.ip, ctx.clock.now()],
    );
}

export async function signUp(
  ctx: AppContext,
  input: {
    email: string;
    password: string;
    fullName: string;
    /** US state (primary market). Country is stored as US; not collected on the form. */
    stateOfResidence: string | null;
    /** Confirms the person does not live in a territory listed in clause 8.5 of the Service Rules. */
    notInRestrictedTerritory: boolean;
    accepted: { slug: string; version: string }[];
    /** Ignored if present (older clients); sign-up always records US. */
    countryOfResidence?: string | null;
  },
  meta: { ip: string | null; userAgent: string | null },
): Promise<{ userId: string; grant: SessionGrant }> {
  const residence = residenceError(input.stateOfResidence);
  if (residence) throw badRequest(residence, { field: 'stateOfResidence' });
  if (input.notInRestrictedTerritory !== true)
    throw badRequest('Confirm that you do not live in a territory listed in clause 8.5 of the Service Rules.', {
      field: 'notInRestrictedTerritory',
    });
  const state = input.stateOfResidence;
  const country = 'US';
  const emailError = validateEmail(input.email);
  if (emailError) throw badRequest(emailError, { field: 'email' });
  const passwordError = validatePassword(input.password);
  if (passwordError) throw badRequest(passwordError, { field: 'password' });
  const docs = requireAcceptance(input.accepted, 'signup');
  const email = normalizeEmail(input.email);
  const hash = await hashPassword(input.password);
  const now = ctx.clock.now();
  const userId = newId('usr');
  const grant = ctx.db.tx(() => {
    if (ctx.db.get('SELECT 1 FROM users WHERE email = ?', [email]))
      throw conflict('An account already uses that email. Sign in instead.', 'email_taken');
    ctx.db.run('INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
      userId,
      email,
      hash,
      'customer',
      now,
      now,
    ]);
    ctx.db.run(
      'INSERT INTO customer_profiles (user_id, full_name, country_of_residence, state_of_residence, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, input.fullName, country, state, now, now],
    );
    recordAcceptances(ctx, userId, docs, 'signup', meta);
    audit(
      ctx,
      { type: 'customer', id: userId, role: 'customer', ip: meta.ip },
      { action: 'auth.signup', targetType: 'user', targetId: userId, data: { country, state, notInRestrictedTerritory: true } },
    );
    notify(ctx, { userId, to: email, template: 'welcome', vars: { name: input.fullName } });
    return createSession(ctx, userId, false, meta);
  });
  return { userId, grant };
}

export type SignInResult = { kind: 'session'; userId: string; grant: SessionGrant } | { kind: 'mfa'; challengeId: string };

export async function signIn(
  ctx: AppContext,
  input: { email: string; password: string; staffOnly?: boolean },
  meta: { ip: string | null; userAgent: string | null },
): Promise<SignInResult> {
  const email = normalizeEmail(input.email);
  const user = ctx.db.get<UserRow>('SELECT * FROM users WHERE email = ?', [email]);
  const now = ctx.clock.now();
  if (user?.locked_until && user.locked_until > now)
    throw new ApiError(429, 'account_locked', 'Too many failed attempts. Try again in 15 minutes or reset your password.');
  const ok = await verifyPassword(input.password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
  const actor: Actor = {
    type: user?.role === 'customer' || !user ? 'customer' : 'operator',
    id: user?.id ?? null,
    role: user?.role ?? null,
    ip: meta.ip,
  };
  // The staff entrance (/admin/login) refuses customer accounts with the same answer as a wrong password, so it reveals nothing.
  const portalOk = !input.staffOnly || (!!user && user.role !== 'customer');
  if (!user || !ok || user.status !== 'active' || !portalOk) {
    if (user && (!ok || user.status !== 'active')) {
      const failures = user.failed_logins + 1;
      ctx.db.run('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?', [
        failures,
        failures >= LOCKOUT_THRESHOLD ? now + LOCKOUT_MS : null,
        user.id,
      ]);
      audit(ctx, actor, { action: 'auth.signin_failed', targetType: 'user', targetId: user.id, data: { failures } });
    }
    throw new ApiError(401, 'invalid_credentials', 'That email and password don’t match an account.');
  }
  ctx.db.run('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?', [user.id]);
  if (user.totp_enabled) {
    const challengeId = randomToken(18);
    ctx.db.run('INSERT INTO login_challenges (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [
      challengeId,
      user.id,
      now,
      now + CHALLENGE_TTL_MS,
    ]);
    return { kind: 'mfa', challengeId };
  }
  const grant = createSession(ctx, user.id, false, meta);
  audit(ctx, actor, { action: 'auth.signin', targetType: 'user', targetId: user.id });
  return { kind: 'session', userId: user.id, grant };
}

export function verifyMfaChallenge(
  ctx: AppContext,
  input: { challengeId: string; code: string },
  meta: { ip: string | null; userAgent: string | null },
) {
  const now = ctx.clock.now();
  const ch = ctx.db.get<{ id: string; user_id: string; expires_at: number; attempts: number }>(
    'SELECT * FROM login_challenges WHERE id = ?',
    [input.challengeId],
  );
  if (!ch || ch.expires_at <= now || ch.attempts >= 5) {
    if (ch) ctx.db.run('DELETE FROM login_challenges WHERE id = ?', [ch.id]);
    throw new ApiError(401, 'challenge_expired', 'This sign-in attempt expired. Start again.');
  }
  const user = ctx.db.get<UserRow>('SELECT * FROM users WHERE id = ?', [ch.user_id])!;
  const secret = user.totp_secret_enc ? decrypt(ctx.config.dataEncryptionKey, user.totp_secret_enc) : null;
  if (!secret || !verifyTotp(secret, input.code.trim(), now)) {
    ctx.db.run('UPDATE login_challenges SET attempts = attempts + 1 WHERE id = ?', [ch.id]);
    throw new ApiError(401, 'bad_code', 'That code is not correct.');
  }
  ctx.db.run('DELETE FROM login_challenges WHERE id = ?', [ch.id]);
  const grant = createSession(ctx, user.id, true, meta);
  audit(
    ctx,
    { type: user.role === 'customer' ? 'customer' : 'operator', id: user.id, role: user.role, ip: meta.ip },
    { action: 'auth.signin', targetType: 'user', targetId: user.id, data: { mfa: true } },
  );
  return { userId: user.id, grant };
}

export function signOut(ctx: AppContext, auth: AuthContext | null) {
  if (auth) ctx.db.run('DELETE FROM sessions WHERE id = ?', [auth.sessionId]);
}

export async function requestPasswordReset(
  ctx: AppContext,
  emailRaw: string,
  ip: string | null,
): Promise<{ sandboxResetUrl: string | null }> {
  const email = normalizeEmail(emailRaw);
  const user = ctx.db.get<UserRow>('SELECT * FROM users WHERE email = ? AND status = ?', [email, 'active']);
  if (!user) return { sandboxResetUrl: null }; // Same response either way: don't reveal which emails have accounts.
  const token = randomToken();
  const now = ctx.clock.now();
  const url = `${ctx.config.publicOrigin}/reset-password/confirm?token=${token}`;
  ctx.db.tx(() => {
    ctx.db.run('UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL', [now, user.id]);
    ctx.db.run('INSERT INTO password_reset_tokens (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', [
      hmac(ctx.config.sessionSecret, `reset:${token}`),
      user.id,
      now,
      now + RESET_TTL_MS,
    ]);
    notify(ctx, { userId: user.id, to: user.email, template: 'password_reset', vars: { url } });
    audit(
      ctx,
      { type: 'customer', id: user.id, role: user.role, ip },
      { action: 'auth.password_reset_requested', targetType: 'user', targetId: user.id },
    );
  });
  return { sandboxResetUrl: ctx.config.sandbox.exposeCodes ? url : null };
}

export async function confirmPasswordReset(ctx: AppContext, token: string, password: string, ip: string | null) {
  const passwordError = validatePassword(password);
  if (passwordError) throw badRequest(passwordError, { field: 'password' });
  const now = ctx.clock.now();
  const row = ctx.db.get<{ user_id: string; expires_at: number; used_at: number | null }>(
    'SELECT * FROM password_reset_tokens WHERE token_hash = ?',
    [hmac(ctx.config.sessionSecret, `reset:${token}`)],
  );
  if (!row || row.used_at || row.expires_at <= now)
    throw new ApiError(400, 'reset_invalid', 'This reset link is invalid or has expired. Request a new one.');
  const hash = await hashPassword(password);
  ctx.db.tx(() => {
    ctx.db.run('UPDATE password_reset_tokens SET used_at = ? WHERE token_hash = ?', [
      now,
      hmac(ctx.config.sessionSecret, `reset:${token}`),
    ]);
    ctx.db.run('UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL, updated_at = ? WHERE id = ?', [
      hash,
      now,
      row.user_id,
    ]);
    ctx.db.run('DELETE FROM sessions WHERE user_id = ?', [row.user_id]);
    audit(
      ctx,
      { type: 'customer', id: row.user_id, role: null, ip },
      { action: 'auth.password_reset', targetType: 'user', targetId: row.user_id },
    );
  });
}

export async function changePassword(ctx: AppContext, auth: AuthContext, current: string, next: string, ip: string | null) {
  const user = ctx.db.get<UserRow>('SELECT * FROM users WHERE id = ?', [auth.userId])!;
  if (!(await verifyPassword(current, user.password_hash)))
    throw new ApiError(400, 'invalid_credentials', 'Your current password is not correct.', { field: 'currentPassword' });
  const passwordError = validatePassword(next);
  if (passwordError) throw badRequest(passwordError, { field: 'newPassword' });
  const hash = await hashPassword(next);
  ctx.db.tx(() => {
    ctx.db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [hash, ctx.clock.now(), auth.userId]);
    ctx.db.run('DELETE FROM sessions WHERE user_id = ? AND id != ?', [auth.userId, auth.sessionId]);
    audit(ctx, actorFor(auth, ip), { action: 'auth.password_changed', targetType: 'user', targetId: auth.userId });
  });
}

export function beginTotpEnrollment(ctx: AppContext, auth: AuthContext): { secret: string; otpauthUrl: string } {
  if (auth.totpEnabled) throw conflict('An authenticator app is already set up.');
  const secret = newTotpSecret();
  ctx.db.run('UPDATE users SET totp_secret_enc = ?, updated_at = ? WHERE id = ?', [
    encrypt(ctx.config.dataEncryptionKey, secret),
    ctx.clock.now(),
    auth.userId,
  ]);
  const label = encodeURIComponent(`${BRAND.name}:${auth.email}`);
  return { secret, otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(BRAND.name)}&digits=6&period=30` };
}

export function confirmTotpEnrollment(ctx: AppContext, auth: AuthContext, code: string, ip: string | null) {
  const user = ctx.db.get<UserRow>('SELECT * FROM users WHERE id = ?', [auth.userId])!;
  if (user.totp_enabled) throw conflict('An authenticator app is already set up.');
  const secret = user.totp_secret_enc ? decrypt(ctx.config.dataEncryptionKey, user.totp_secret_enc) : null;
  if (!secret || !verifyTotp(secret, code.trim(), ctx.clock.now()))
    throw new ApiError(400, 'bad_code', 'That code is not correct. Check the time on your phone and try again.');
  ctx.db.tx(() => {
    ctx.db.run('UPDATE users SET totp_enabled = 1, updated_at = ? WHERE id = ?', [ctx.clock.now(), auth.userId]);
    ctx.db.run('UPDATE sessions SET mfa_verified = 1 WHERE id = ?', [auth.sessionId]);
    ctx.db.run('DELETE FROM sessions WHERE user_id = ? AND id != ?', [auth.userId, auth.sessionId]);
    audit(ctx, actorFor(auth, ip), { action: 'auth.totp_enabled', targetType: 'user', targetId: auth.userId });
  });
}

export function disableTotp(ctx: AppContext, auth: AuthContext, code: string, ip: string | null) {
  const user = ctx.db.get<UserRow>('SELECT * FROM users WHERE id = ?', [auth.userId])!;
  if (!user.totp_enabled || !user.totp_secret_enc) throw conflict('No authenticator app is set up.');
  if (user.role !== 'customer' && ctx.config.requireStaffMfa)
    throw new ApiError(403, 'mfa_required', 'Staff accounts must keep an authenticator app.');
  if (!verifyTotp(decrypt(ctx.config.dataEncryptionKey, user.totp_secret_enc), code.trim(), ctx.clock.now()))
    throw new ApiError(400, 'bad_code', 'That code is not correct.');
  ctx.db.tx(() => {
    ctx.db.run('UPDATE users SET totp_enabled = 0, totp_secret_enc = NULL, updated_at = ? WHERE id = ?', [ctx.clock.now(), auth.userId]);
    audit(ctx, actorFor(auth, ip), { action: 'auth.totp_disabled', targetType: 'user', targetId: auth.userId });
  });
}

export function listSessions(ctx: AppContext, auth: AuthContext) {
  return ctx.db
    .all<{
      id: string;
      created_at: number;
      last_seen_at: number;
      ip: string | null;
      user_agent: string | null;
    }>(
      'SELECT id, created_at, last_seen_at, ip, user_agent FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY last_seen_at DESC',
      [auth.userId, ctx.clock.now()],
    )
    .map((s) => ({
      id: s.id.slice(0, 12),
      current: s.id === auth.sessionId,
      createdAt: s.created_at,
      lastSeenAt: s.last_seen_at,
      ip: s.ip,
      userAgent: s.user_agent,
    }));
}

export function revokeOtherSessions(ctx: AppContext, auth: AuthContext, ip: string | null): number {
  const { changes } = ctx.db.run('DELETE FROM sessions WHERE user_id = ? AND id != ?', [auth.userId, auth.sessionId]);
  audit(ctx, actorFor(auth, ip), { action: 'auth.sessions_revoked', targetType: 'user', targetId: auth.userId, data: { count: changes } });
  return changes;
}

export function actorFor(auth: AuthContext, ip: string | null): Actor {
  return { type: auth.role === 'customer' ? 'customer' : 'operator', id: auth.userId, role: auth.role, ip };
}

/** Creates a staff or customer account from the CLI or sandbox seed (no session). */
export async function createAccount(
  ctx: AppContext,
  input: { email: string; password: string; role: Role; fullName: string; totpSecret?: string },
): Promise<string> {
  const err = validateEmail(input.email) ?? validatePassword(input.password);
  if (err) throw badRequest(err);
  const id = newId('usr');
  const now = ctx.clock.now();
  const hash = await hashPassword(input.password);
  ctx.db.tx(() => {
    ctx.db.run(
      'INSERT INTO users (id, email, password_hash, role, totp_secret_enc, totp_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        normalizeEmail(input.email),
        hash,
        input.role,
        input.totpSecret ? encrypt(ctx.config.dataEncryptionKey, input.totpSecret) : null,
        input.totpSecret ? 1 : 0,
        now,
        now,
      ],
    );
    ctx.db.run('INSERT INTO customer_profiles (user_id, full_name, created_at, updated_at) VALUES (?, ?, ?, ?)', [
      id,
      input.fullName,
      now,
      now,
    ]);
    audit(
      ctx,
      { type: 'system', id: null, role: null, ip: null },
      { action: 'user.created', targetType: 'user', targetId: id, data: { role: input.role } },
    );
  });
  return id;
}

export const requiredSignupDocuments = currentSignupDocs;
