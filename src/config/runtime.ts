/**
 * Runtime safety configuration.
 *
 * Real-money movement is hard-disabled. There is deliberately no environment
 * variable that flips this: enabling it must be a reviewed code change made
 * only after the items in docs/compliance-readiness.md are signed off.
 */
export const REAL_MONEY_ENABLED = false as const;

export type ServiceMode = 'mock';

export function resolveServiceMode(raw: string | undefined): ServiceMode {
  const mode = raw ?? 'mock';
  if (mode !== 'mock') {
    // Fail closed: only mock adapters exist. A misconfigured deploy must not
    // silently fall back to something that looks live.
    throw new Error(`Unsupported VITE_SERVICE_MODE "${mode}". Only "mock" is implemented; production adapters do not exist yet.`);
  }
  return mode;
}

export const FEATURE_FLAGS = {
  /** Courier cash delivery stays off until legal, licensing, insurance and operating requirements are verified. */
  courierCashDelivery: false,
} as const;
