import { t } from '@/i18n';
import { ApiError } from '@/services/http';

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return t(e.message);
  return t(e instanceof Error ? e.message : 'Something went wrong. Try again.');
}

/** The server's NOT_CONFIGURED state: a provider has no credentials yet. Shown as such, never as a failure of the customer's input. */
export function isNotConfigured(e: unknown): boolean {
  return e instanceof ApiError && e.code === 'NOT_CONFIGURED';
}
