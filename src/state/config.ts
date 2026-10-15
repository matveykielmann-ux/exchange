import { useServices } from './services';

/** Public server configuration, fetched once at start-up. */
export function useConfig() {
  return useServices().config;
}

/** True when the server runs in sandbox mode: every price, deposit and payout is simulated. */
export function useIsSandbox(): boolean {
  return useServices().config.mode === 'sandbox';
}
