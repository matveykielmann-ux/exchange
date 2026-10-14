/**
 * Country of residence. The Service is not limited to US residents (owner
 * decision, 2026-10-14). The only geographic restriction the Service Rules
 * document is clause 8.5, which names territories rather than whole
 * countries, so sign-up asks for the country and a confirmation that the
 * person does not live in any of those territories.
 */

/** ISO 3166-1 alpha-2 codes. Display names come from the runtime (Intl.DisplayNames). */
export const COUNTRY_CODES = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI ' +
  'CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ ' +
  'GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS ' +
  'LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG ' +
  'PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK ' +
  'TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ');

export type CountryCode = string;

export function isCountryCode(v: unknown): v is CountryCode {
  return typeof v === 'string' && COUNTRY_CODES.includes(v);
}

let names: Intl.DisplayNames | null = null;
export function countryName(code: string): string {
  try {
    names ??= new Intl.DisplayNames(['en'], { type: 'region' });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Countries sorted by English name, for a select. */
export function countryOptions(): { code: CountryCode; name: string }[] {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/** The territories clause 8.5 of the Service Rules excludes, in its own words. */
export const RESTRICTED_TERRITORIES = [
  'the Republic of Abkhazia',
  'the Republic of South Ossetia',
  'the Nagorno-Karabakh Republic',
  'the Turkish Republic of Northern Cyprus',
  'the Transnistrian Moldavian Republic',
  'territories temporarily not controlled by the government of Ukraine, including the Autonomous Republic of Crimea and certain areas of Donetsk and Luhansk regions',
] as const;

/** Applies a US state only when the country is the United States. */
export function residenceError(country: string, state: string | null): string | null {
  if (!isCountryCode(country)) return 'Choose your country of residence.';
  if (country === 'US' && !state) return 'Choose your US state of residence.';
  return null;
}
