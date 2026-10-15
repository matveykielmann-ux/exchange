/**
 * Runtime safety configuration.
 *
 * Money-moving providers become usable only when credentials are present and
 * each operation still passes server-side validation, authorization, and
 * provider availability checks (`isUsable`). There is no silent fallback to
 * simulated deposits or payouts in production mode.
 *
 * Enabling real provider adapters still requires contracted vendors, secrets,
 * and the operational checklist in docs/compliance-readiness.md.
 */
export const REAL_MONEY_ENABLED = true as const;

export const FEATURE_FLAGS = {
  /**
   * Courier cash delivery: offered in the product (owner decision, 2026-10-14).
   * Real cash payouts still require a configured CASH_PROVIDER and a contracted
   * carrier; until then the production cash adapter reports not_configured.
   */
  courierCashDelivery: true,
} as const;
