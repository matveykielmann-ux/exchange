# Compliance readiness

> **This is not legal advice.** It is an engineering checklist drawn from secondary research (`docs/research_notes/Crypto to USD exchange UX/us_compliance_readiness.md`). This environment's network policy blocked direct access to fincen.gov, ofac.treasury.gov, dfpi.ca.gov, ftc.gov and the eCFR, so **every citation must be verified against the primary text by qualified counsel** before it is relied on.

## Current status

| Item | Status |
|---|---|
| Operating legal entity | **None formed or verified** |
| FinCEN MSB registration | **None** |
| State money transmitter / virtual-currency licenses | **None** |
| NMLS record | **None** |
| Bank, payout, custody, KYC, screening or courier contracts | **None** |
| AML/BSA program, compliance officer, independent testing | **None** |
| Real-money capability | **Disabled in code** (`REAL_MONEY_ENABLED = false`; production adapters exist but report `NOT_CONFIGURED` without credentials and `DISABLED_BY_POLICY` for anything that moves money; unknown modes fail closed) |

The site states all of this plainly: the sitewide sandbox banner, the footer, `/legal/contact` (licensing and registrations), and SANDBOX/MOCK badges on every simulated price, quote, receipt and status.

## Launch gate: all must be verified and signed off

### 1. Entity and federal registration
- [ ] Form the operating entity; confirm ownership, control persons and beneficial owners.
- [ ] Counsel confirms the business model is "money transmission" by an exchanger of convertible virtual currency. *Research points to FinCEN guidance FIN-2019-G001 (May 9, 2019); verify.*
- [ ] Register with FinCEN as an MSB within the required window (research indicates 180 days of establishment; verify). Registration is not a license.
- [ ] Confirm that operating without required licensing is not occurring (18 U.S.C. § 1960 risk).

### 2. State licensing
- [ ] Make a state-by-state determination of money transmitter / virtual-currency licensing for every state served. Track adoption of the Money Transmission Modernization Act (research found conflicting counts of about 30–35 states as of 2026; verify).
- [ ] **New York:** BitLicense and/or money transmitter license, or exclude NY residents. Research notes 23 NYCRR Part 200 pre-transaction risk disclosures (§ 200.19); verify the wording.
- [ ] **California:** DFAL licensing (research indicates applications opened via NMLS in March 2026 and licensing became required July 1, 2026, with SB 97 amendments); verify status and any transition relief before serving CA residents.
- [ ] Surety bonds, net-worth and permissible-investment requirements per state.
- [ ] Geo-restriction for unlicensed states, enforced server-side (not just in the UI).

### 3. AML / BSA program
- [ ] Written AML program; designated BSA officer; training; independent testing. *Track FinCEN's re-proposed AML program rule (research indicates April 2026) for final requirements.*
- [ ] Customer identification and KYC tiers (current UI: unverified, verified, enhanced), using a contracted identity-verification provider.
- [ ] Enhanced due diligence and source-of-funds checks for the large-transaction desk.
- [ ] Transaction monitoring; SAR process and thresholds *(research could not confirm the MSB SAR threshold; verify)*.
- [ ] Recordkeeping and Travel Rule for transmittals of $3,000 or more *(31 CFR 1010.410; verify)*.
- [ ] CTR process for cash over $10,000 per person per business day, with aggregation. Relevant only if cash is ever offered; see §6.
- [ ] Geographic Targeting Orders: monitor FinCEN GTOs that lower cash-reporting thresholds in specific areas *(research notes southwest-border GTOs and related litigation in 2025–2026; verify)*.

### 4. Sanctions
- [ ] OFAC screening of customers, counterparties, IP geolocation and **blockchain addresses**, plus blockchain analytics with exposure lookback *(OFAC virtual-currency guidance, October 2021; verify)*. OFAC liability is strict.
- [ ] Blocking and rejection procedures and reporting.
- [ ] The current UI screens the refund address at confirmation and holds flagged transactions for review before payout (simulated).

### 5. Consumer protection and disclosures
- [ ] Counsel-approved Terms, Privacy Policy (GLBA and state privacy law), E-SIGN consent and complaint handling.
- [ ] Pre-transaction disclosure of rate, spread and fees, and a receipt. The UI already itemizes reference price, spread, payout fee and net payout to the cent; legal review must confirm the required content and form per state.
- [ ] Determine whether Regulation E or the Remittance Rule applies to the USD payout leg *(open question in research)*.
- [ ] Risk disclosures: not legal tender; not FDIC/SIPC insured; irreversibility; volatility; stablecoin de-peg; scam warnings. A draft is at `/legal#risk`.
- [ ] Scam and elder-fraud controls: friction for first-time large sales, cooling-off review, plain-language warnings *(research cites FTC and FinCEN alerts on crypto-ATM and impersonation scams; verify current figures before quoting)*.
- [ ] **Advertising review.** No claims of licensing, insurance, FDIC coverage, guaranteed settlement times, "safest" or "no KYC". No testimonials, user counts or partner logos without substantiation. *Research cites FDIC Part 328 (deposit-insurance misrepresentation), FTC actions over "safer than a bank" claims, and the FTC's 2024 rule on fake reviews and testimonials.*

### 6. Courier cash delivery: **remains disabled**
The feature flag `FEATURE_FLAGS.courierCashDelivery = false`. The payout option is shown, disabled and explained, and the availability service returns "not available" everywhere. The research found **no US precedent** for a regulated exchange delivering cash to homes, and identified the highest AML and physical-safety exposure of any payout method. Enabling it requires all of the following:
- [ ] Licensing analysis confirming in-person cash disbursement is permitted for each service area.
- [ ] CTR filing, aggregation across visits and agents, structuring detection, GTO compliance.
- [ ] A contracted, licensed and bonded armored or courier carrier with all-risk insurance meeting state minimums *(research cites e.g. NY requirements; verify)*.
- [ ] In-person identity re-verification at handoff, with an audit trail.
- [ ] Safety protocols: duress signals, public handoff points, amount caps, robbery and coercion risk assessment *(research notes rising physical "wrench attacks" in 2025)*.
- [ ] City and county legal review per area; insurance and operational sign-off.

### 7. Operations and security
- [ ] Contracted providers for pricing/liquidity, custody or wallet infrastructure, blockchain monitoring, KYC, screening, and bank payouts (ACH, wire, push-to-card with PCI DSS tokenization).
- [ ] Server-side quotes (submit only `quoteId`), authenticated provider webhooks, idempotency, reconciliation, treasury and hedging controls.
- [ ] Real authentication (OIDC, httpOnly cookies, WebAuthn/TOTP, rate limits), security headers and CSP, penetration test, incident response, vulnerability disclosure program.
- [ ] Customer support and complaint channels; published hours and response targets (none are promised today).
- [ ] Trademark clearance for the brand name (**"Arcvale" is a working name; it replaced the placeholder "Settlewell"**).

## Language rules for the preview (enforced in copy)

| Never say | Say instead |
|---|---|
| "Licensed", "regulated", "FDIC insured", "insured" | "Licensing status: none" / "not FDIC or SIPC insured" |
| "Instant", "guaranteed in X minutes" | "Estimated …; not guaranteed" |
| "Trusted by N customers", testimonials, partner logos | Nothing. Show the mechanism (itemized quote) instead. |
| "Bank-grade security" | Specific, checkable controls, labelled "simulated in this preview" |
| Real-looking deposit addresses | `MOCK-…-DO-NOT-SEND` placeholders, invalid on every chain, refused by the UI otherwise |
