import type { PublicConfig } from '@/services/types';

/** Which product surface the current browser origin should show. */
export type SiteSurface = 'customer' | 'crm';

/**
 * When CRM_ORIGIN is configured and the page is opened on that origin, only
 * the admin CRM is shown. Otherwise the customer site is shown (and /admin*
 * redirects to the CRM origin when split is enabled).
 */
export function resolveSiteSurface(config: Pick<PublicConfig, 'publicOrigin' | 'crmOrigin'>, locationOrigin = window.location.origin): SiteSurface {
  if (config.crmOrigin && locationOrigin === config.crmOrigin) return 'crm';
  return 'customer';
}

/** True when customer and CRM are on separate hostnames. */
export function isSplitHosts(config: Pick<PublicConfig, 'crmOrigin'>): boolean {
  return !!config.crmOrigin;
}
