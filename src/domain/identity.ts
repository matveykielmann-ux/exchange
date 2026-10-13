/** Identity-verification tiers and the rules that depend on them. Shared by UI and services. */
export type VerificationLevel = 'unverified' | 'verified' | 'enhanced';

/** Online exchanges need at least basic verification. */
export function canConfirmExchange(level: VerificationLevel): boolean {
  return level !== 'unverified';
}
