/**
 * Residence for sign-up. The owner treats the United States as the primary market
 * (2026-03-01 package): the form collects a US state only. Availability for
 * customers outside the US is handled through support, not as a country field.
 *
 * Clause 8.5 of the Service Rules still lists territories that are refused.
 * Listing all US states in the UI does not mean every state is licensed.
 */

import { US_STATES_50, type UsStateCode } from './usStates';

/** The territories clause 8.5 of the Service Rules excludes, in its own words. */
export const RESTRICTED_TERRITORIES = [
  'the Republic of Abkhazia',
  'the Republic of South Ossetia',
  'the Nagorno-Karabakh Republic',
  'the Turkish Republic of Northern Cyprus',
  'the Transnistrian Moldavian Republic',
  'territories temporarily not controlled by the government of Ukraine, including the Autonomous Republic of Crimea and certain areas of Donetsk and Luhansk regions',
] as const;

/** Validates US state selection for sign-up / profile (primary market — 50 states). */
export function residenceError(state: string | null | undefined): string | null {
  if (!state || !US_STATES_50.includes(state as UsStateCode)) return 'Choose your US state of residence.';
  return null;
}

/** @deprecated Country is no longer collected at sign-up; kept for profile display of legacy rows. */
export const COUNTRY_CODES = ['US'] as const;
export type CountryCode = string;
export function isCountryCode(v: unknown): v is CountryCode {
  return v === 'US';
}
export function countryName(code: string, _lang = 'en'): string {
  return code === 'US' ? 'United States' : code;
}
export function countryOptions(_lang = 'en'): { code: CountryCode; name: string }[] {
  return [{ code: 'US', name: 'United States' }];
}
