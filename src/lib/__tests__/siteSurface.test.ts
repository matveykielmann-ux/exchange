import { describe, expect, it } from 'vitest';
import { isSplitHosts, resolveSiteSurface } from '../siteSurface';

describe('siteSurface', () => {
  it('uses customer surface when CRM_ORIGIN is unset (single-host local mode)', () => {
    const config = { publicOrigin: 'http://localhost:5173', crmOrigin: null };
    expect(resolveSiteSurface(config, 'http://localhost:5173')).toBe('customer');
    expect(isSplitHosts(config)).toBe(false);
  });

  it('selects CRM surface only on the CRM origin', () => {
    const config = { publicOrigin: 'https://example.com', crmOrigin: 'https://crm.example.com' };
    expect(resolveSiteSurface(config, 'https://crm.example.com')).toBe('crm');
    expect(resolveSiteSurface(config, 'https://example.com')).toBe('customer');
    expect(isSplitHosts(config)).toBe(true);
  });
});
