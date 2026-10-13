/**
 * Simulated identity verification. Always approves after a short delay and
 * says so — no documents or personal data are collected in the preview.
 */
import type { KycProvider, VerificationLevel } from '../types';
import { delay, type MockOptions } from './util';

export function createMockKyc(opts: MockOptions, onApproved: (email: string, level: VerificationLevel) => void): KycProvider {
  return {
    startVerification(email, level) {
      return delay(opts, () => {
        onApproved(email, level);
        return { status: 'approved' as const, level, source: 'mock' as const };
      });
    },
  };
}
