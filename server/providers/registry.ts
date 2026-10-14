import type { AppConfig } from '../config';
import type { Logger } from '../logger';
import { createProductionProviders } from './production';
import { createSandboxProviders } from './sandbox';
import type { ProviderInfo, Providers, WebhookSource } from './types';

/** Sandbox mode gets sandbox providers; production mode gets production adapters only. There is no mixing. */
export function createProviders(config: AppConfig, log: Logger, now: () => number): Providers {
  return config.mode === 'sandbox' ? createSandboxProviders(config, now) : createProductionProviders(config, log);
}

export function providerInfos(p: Providers): ProviderInfo[] {
  return [p.rates, p.custody, p.identity, p.screening, p.bankPayout, p.cardPayout, p.cash, p.email].map((x) => x.info());
}

export function isUsable(info: ProviderInfo): boolean {
  return info.state === 'sandbox' || info.state === 'configured';
}

/** Secret used to verify webhooks from a source, or null when that source is not configured. */
export function webhookSecret(config: AppConfig, source: WebhookSource): string | null {
  if (config.mode === 'sandbox') return config.sandbox.webhookSecret;
  const creds = {
    custody: config.providers.custody,
    identity: config.providers.identity,
    bankPayout: config.providers.bankPayout,
    cardPayout: config.providers.cardPayout,
    cash: config.providers.cash,
  }[source];
  return creds?.webhookSecret ?? null;
}
