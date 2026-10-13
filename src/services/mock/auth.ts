/**
 * Mock authentication. Passwords are validated for shape and then DISCARDED —
 * nothing secret is stored. The second factor accepts the fixed preview code
 * 000000. A production adapter would delegate to an identity provider.
 */
import { validateEmail, validatePassword } from '@/domain/validation';
import { readStore, removeStore, writeStore } from '@/lib/storage';
import type { AuthService, User, VerificationLevel } from '../types';
import { delay, mockId, MockServiceError, type MockOptions } from './util';

export const MOCK_MFA_CODE = '000000';
const USERS_KEY = 'users';
const SESSION_KEY = 'session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

type UserTable = Record<string, User>;
interface Session {
  email: string;
  expiresAt: number;
}

const normalize = (email: string) => email.trim().toLowerCase();

export function createMockAuth(opts: MockOptions): AuthService & { setVerification(email: string, level: VerificationLevel): void } {
  const listeners = new Set<(u: User | null) => void>();
  const challenges = new Map<string, string>();

  const users = (): UserTable => readStore<UserTable>(USERS_KEY, {});
  const emit = () => {
    const u = current();
    listeners.forEach((l) => l(u));
  };

  function current(): User | null {
    const session = readStore<Session | null>(SESSION_KEY, null);
    if (!session) return null;
    if (session.expiresAt <= opts.now()) {
      removeStore(SESSION_KEY);
      return null;
    }
    return users()[session.email] ?? null;
  }

  function startSession(email: string) {
    writeStore(SESSION_KEY, { email, expiresAt: opts.now() + SESSION_TTL_MS } satisfies Session);
  }

  return {
    currentUser: current,

    signUp({ name, email, password }) {
      return delay(opts, () => {
        const emailError = validateEmail(email) ?? validatePassword(password);
        if (emailError) throw new MockServiceError(emailError, 'invalid_input');
        if (!name.trim()) throw new MockServiceError('Enter your full name.', 'invalid_input');
        const key = normalize(email);
        const table = users();
        if (table[key]) throw new MockServiceError('A preview account already exists for that email. Sign in instead.', 'exists');
        const user: User = { email: key, name: name.trim(), createdAt: opts.now(), verification: 'unverified' };
        writeStore(USERS_KEY, { ...table, [key]: user });
        startSession(key);
        emit();
        return user;
      });
    },

    signIn({ email, password }) {
      return delay(opts, () => {
        const err = validateEmail(email) ?? (password ? null : 'Enter your password.');
        if (err) throw new MockServiceError(err, 'invalid_input');
        const key = normalize(email);
        if (!users()[key]) throw new MockServiceError('No preview account uses that email. Create one first.', 'not_found');
        const challengeId = mockId(opts, 12);
        challenges.set(challengeId, key);
        return { challengeId };
      });
    },

    verifyMfa({ challengeId, code }) {
      return delay(opts, () => {
        const email = challenges.get(challengeId);
        if (!email) throw new MockServiceError('This sign-in attempt expired. Start again.', 'challenge_expired');
        if (code.trim() !== MOCK_MFA_CODE) throw new MockServiceError('That code is not correct.', 'bad_code');
        challenges.delete(challengeId);
        startSession(email);
        emit();
        const user = users()[email];
        if (!user) throw new MockServiceError('Account not found.', 'not_found');
        return user;
      });
    },

    signOut() {
      removeStore(SESSION_KEY);
      emit();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    setVerification(email, level) {
      const table = users();
      const user = table[email];
      if (!user) return;
      writeStore(USERS_KEY, { ...table, [email]: { ...user, verification: level } });
      emit();
    },
  };
}
