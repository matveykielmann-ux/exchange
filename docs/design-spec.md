# Design specification — Arcvale (working name)

Status: v1, Phase 1 output. Owner: product/design. Applies to every page in `src/`.

> **Superseded visual identity (2026-10-14).** Colours, logo and the hero now follow the approved CryptoBit Exchange brand board: a dark default theme (deep black, graphite surfaces, champagne gold accent) plus an optional light theme (warm ivory canvas, white surfaces, deepened gold) chosen with the header sun/moon toggle and stored as `cryptobit.theme`, the gold globe-and-orbit mark (`public/brand/`) and the "Exchange Without Limits / Fast. Secure. Global." hero with the 3D BTC and USD coins (the mark is the no-WebGL fallback). The values live in `src/styles/tokens.css`; `public/theme-init.js` applies the stored choice before first paint. Layout, typography scale, spacing, accessibility and motion rules below still apply.

> **Arcvale is a working name** (it replaced the earlier placeholder "Settlewell"). It has not had trademark clearance. The name lives in one constant (`src/config/brand.ts`) so it can be replaced in one edit.

## 1. Research basis and limits

The research notes are in `docs/research_notes/Crypto to USD exchange UX/`. The synthesized report is `docs/reports/Crypto to USD exchange UX.md`. References: coinbase.com, kraken.com, cash.app, Behance "crypto exchange UI", Dribbble "crypto-exchange", plus US regulatory sources.

**Limitation.** This environment's network policy blocked direct connections to every reference site. Findings rest on web-search summaries of cited pages, not on viewing the live screens. Nothing in this spec copies a reference layout. Treat the competitive observations as directional, and re-check them in a browser that can reach the sites before using them for anything beyond design direction.

### What we took from the research

| Observation (source notes) | Design consequence |
|---|---|
| Coinbase and Kraken make cash-out two steps: sell to a USD balance, then withdraw to a bank. Each step has its own preview. | **One quote, one confirmation, one status tracker** from crypto deposit to USD payout. No custodial USD balance in this product. |
| The spread is often absorbed into the price and explained only in a tooltip (Coinbase). Kraken shows a fee breakdown on confirm. Reviewers call costs hard to follow. | The **spread is its own line item in dollars and percent**, next to the reference price. The line items add up exactly to the payout, to the cent. |
| Payout speed is sold in tiers (ACH free, 0–2 business days; wire with a flat fee; instant at a percentage with a cap). Speed is always hedged ("typically", "may"). | The payout method is a **choice between option rows, each showing its price and estimated timing**. Timing is always an estimate. We never promise a settlement time. |
| Kraken shows network, minimum and confirmations on its deposit screen. Coinbase preselects a network and makes the user acknowledge before switching. | **The asset and its network are chosen together.** Every deposit screen states the network, minimum, required confirmations and a wrong-network warning. |
| Large trades are gated: Kraken OTC publishes a $50K minimum; Coinbase Prime onboards after compliance review. | There is a dedicated **Large transactions** page with a request form. It sets expectations about review, source of funds and wallet checks, and promises no turnaround time. |
| Cash App: one accent color, one feature per section, and a short legal line used everywhere backed by full legal pages. | **Two-tier disclosure:** a sitewide preview banner and footer line, plus a full Legal page. |
| Gallery tropes (dark canvases, neon/purple gradients, glassmorphism, 3D coins, chart mosaics) read as "generic crypto". | A light, typographic, calm design. **No price charts**, no gradients, no 3D coins. |
| FTC rule (Aug 2024) bans fake reviews and testimonials. FDIC Part 328 bans misrepresenting deposit insurance. The FTC acted against "safer than a bank" claims. | No testimonials, partner logos, insurance or FDIC language, license claims or guaranteed speeds. See `docs/compliance-readiness.md`. |

## 2. Positioning and audience

- **Product:** sell BTC, ETH, USDT or USDC and receive US dollars in a US bank account. Retail transactions up to $25,000; a separate desk flow above that. Courier cash delivery exists only as a disabled module.
- **Retail audience:** US adults who already hold crypto in a self-custody wallet or on another exchange and want dollars. They value knowing exactly what they'll receive before committing.
- **Large-transaction audience:** individuals and businesses moving $25,000 or more. They expect a human desk, enhanced verification and wire payout.
- **Voice:** plain American English. Short declarative sentences. Numbers first. No hype ("moon", "lightning-fast", "revolutionary"). We say what we know, label what we estimate, and say plainly what is not available.

## 3. Information architecture

```
Header: Logo · Sell crypto · Large transactions · Fees · How it works · Security · Help  |  Sign in · [Start an exchange]
/                    Home (hero calculator, what-you-see quote anatomy, how it works, assets & networks, payout methods, large-tx band, security posture, FAQ excerpt)
/exchange            Multi-step flow: 1 Amount → 2 Payout → 3 Details → 4 Review & confirm
/transactions        History (auth)
/transactions/:id    Status: deposit instructions + timeline + receipt
/large-transactions  Desk overview + request form
/cash-delivery       Courier module status (disabled) and readiness requirements
/fees /how-it-works /security /faq /help /legal
/signin /signup /account (Overview · Verification · Payout methods · Security)
Footer: Product · Company resources · Legal; preview disclosure; risk line
```

**Primary conversion journey:** the homepage calculator → *Continue* carries the amount, asset and network into `/exchange` at step 2. The user needs to sign in and have (mock) verification before step 4's confirm button turns on. Signing in returns the user to the same step with the draft intact.

## 4. Visual language

### 4.1 Color tokens (light theme)

Contrast ratios are computed with the WCAG 2.x formula against the canvas and white.

| Token | Hex | Use |
|---|---|---|
| `--canvas` | `#FAF8F4` | Page background (warm white) |
| `--surface` | `#FFFFFF` | Calculator, quote, forms, tables |
| `--surface-sunken` | `#F3F0EA` | Input wells, zebra rows, hover |
| `--line` | `#E4DED3` | Decorative hairlines only |
| `--line-strong` | `#8E8A80` | Input borders, focusable outlines (3.25:1) |
| `--ink-900` | `#0F1E36` | Headings, figures, primary button fill (15.7:1) |
| `--ink-700` | `#3A4660` | Body text (8.9:1) |
| `--ink-500` | `#5F6878` | Labels, captions (5.3:1) |
| `--ink-400` | `#7A8291` | Placeholder or disabled text only |
| `--emerald-700` | `#0B6B4C` | Links, focus ring, selected state, accent text (6.15:1) |
| `--emerald-600` | `#0E7C58` | Hover and icon emerald |
| `--emerald-tint` | `#E8F3EE` | Selected-row and completed-step backgrounds |
| `--warn` / `--warn-tint` | `#8A5300` / `#FBF1DC` | Expiring quotes, network cautions, **mock labels** |
| `--danger` / `--danger-tint` | `#B42318` / `#FDEDEB` | Errors, failed or cancelled |
| `--info` / `--info-tint` | `#2B4C8C` / `#EAF0FA` | Pending and processing |

**Usage ratio:** about 75% neutrals, about 20% navy, emerald at most 5–10% of a screen. **Primary buttons are navy**, so the brand emerald is never confused with "success". "Completed" is emerald and always paired with a check icon and a text label. No red-up/green-down trading colors anywhere.

### 4.1.1 Dark theme

The app follows the system color scheme and has a sun/moon toggle in the header; the choice is stored in `localStorage` (`settlewell.theme`) and applied before first paint by an inline script in `index.html`. Every color is a token in `src/styles/tokens.css`; the dark palette redefines the same tokens, so components never branch on the theme.

- Canvas `#08111F`, surface `#0E1A2E`, sunken `#13223A`, hairline `#213350`. Ink is light (`--ink-900` `#EEF2F7`).
- Emerald lifts to `#34C08E` so links, focus and "completed" keep at least 4.5:1 on the dark surfaces.
- **The primary button is emerald with dark text in the dark theme** (`--cta-bg`, `--cta-fg`), because a navy button on a navy canvas has no contrast. Light theme keeps navy primary buttons. Semantic tokens (`--cta-*`, `--on-ink`, `--on-emerald`, `--navy`, `--header-bg`) carry the difference.
- Dark is not a "crypto" look: still no gradients, glow, glass or neon. The axe scan runs in both themes (`QA_THEME=light`).

### 4.2 Typography

- **Display:** *Instrument Serif* (OFL, self-hosted), used only for H1 and H2 marketing headlines, at regular weight. It gives an editorial, established-institution tone that crypto templates lack.
- **UI and figures:** *Geist* variable (OFL, self-hosted) with `font-variant-numeric: tabular-nums` on every money figure. Not Inter (a deliberate move away from the template default).
- **Mono:** *Geist Mono*, only for addresses, transaction IDs, hashes and the transaction event log.
- Fonts are bundled via `@fontsource`, so there are no third-party font requests (better for privacy and CSP).

| Step | Size / line height | Use |
|---|---|---|
| display-xl | clamp(44px → 76px) / 1.02 | Home H1 |
| display-l | clamp(34px → 52px) / 1.08 | Page H1 |
| display-m | clamp(28px → 38px) / 1.15 | Section H2 |
| figure-xl | clamp(36px → 52px) / 1.0, 560 weight, tabular | "You receive" amount |
| figure-l | 28px / 1.1, 560 weight | Secondary figures |
| title | 20px / 1.3, 600 weight | Card and step titles |
| body-l | 18px / 1.55 | Lead paragraphs |
| body | 16px / 1.55 | Default |
| small | 14px / 1.45 | Labels, table cells |
| micro | 12.5px / 1.4, 0.04em tracking, uppercase | Eyebrows, badges |

Currency codes sit next to figures at about 45% of the figure size, in `--ink-500`.

### 4.3 Space, grid, shape

- 4px base unit; spacing scale `4 8 12 16 20 24 32 40 48 64 80 112 144`.
- Content max width 1200px; 12-column grid; gutters 24px (desktop) and 16px (mobile, per the 16px side-gutter rule).
- Section rhythm: 112px (desktop), 80px (tablet), 64px (mobile).
- **Radii vary by role** (avoiding uniform rounded corners): inputs and buttons 10px, calculator and panels 16px, badges 6px, tables 0 with hairlines.
- Elevation is used sparingly: a single soft shadow on the calculator panel only (`0 1px 2px rgb(15 30 54 / 6%), 0 12px 32px -12px rgb(15 30 54 / 14%)`). Everything else is flat, separated by hairlines.

### 4.4 Imagery and iconography

- No stock photography, no 3D coins, no illustrated mascots.
- Inline SVG line icons on a 1.5px stroke and 20px grid, plus asset glyphs as simple monograms (we do not ship third-party token logos).
- Visual interest comes from typography, figures, hairline structure and one navy "large transactions" band.

## 5. Components and states

| Component | Spec |
|---|---|
| **Amount input** | Large tabular figure (figure-l), asset code suffix, `inputmode="decimal"`. Validation runs on blur, then on every keystroke once an error is showing. Errors are wired with `aria-describedby` and `aria-invalid` and give a specific fix ("Minimum is $50.00 — about 0.00078 BTC"). |
| **Asset + network picker** | Two linked native `<select>`s, so they stay accessible: asset first, then the network filtered to that asset. Changing the network shows a note restating that the network must match the sending wallet. Network is required for USDT and USDC. BTC and ETH show their single network as fixed text. |
| **Quote breakdown** | A definition list: reference price → gross value → spread (−$, %) → payout fee (−$) → **You receive** (figure-xl). Every row is tabular and right-aligned. Lines reconcile exactly. An "Indicative · mock pricing" badge sits beside the heading. |
| **Quote timer** | A text countdown ("Refreshes in 0:12") with a thin progress hairline, and `aria-live="polite"` only on the expiry change, not every tick. On the review step an expired quote disables Confirm and offers "Get a new quote". |
| **Payout option rows** | Radio cards: method name, estimated timing, fee, eligibility. The unavailable courier option is shown disabled with its reason, never hidden, and cannot be selected. |
| **Stepper** | An `<ol>` with text labels, `aria-current="step"`, and completed steps shown with a check icon plus "Completed" visually-hidden text. |
| **Status timeline** | An ordered list with a summary pill on top. Pending and processing use info blue, completed uses emerald with a check, failed or cancelled use danger with an X icon plus text. |
| **Notices** | `info` / `warn` / `danger` variants with an icon and a title. Mock notices use `warn` with a "MOCK" badge. |
| **Buttons** | Primary (navy fill), secondary (outline), tertiary (text link style). 44px minimum target. Focus is a 2px emerald ring with a 2px offset, always visible on keyboard focus. Disabled buttons keep their label legible and explain why nearby. |
| **Forms** | A visible label on every field (no placeholder-only labels). Helper text below. Errors are inline and also summarized at the top after a failed submit, with focus moved to the summary. |
| **Empty, loading, error** | Empty states give one sentence and one action. Loading uses skeleton figures, not spinners on figures. Errors say what happened and what to do next. |

## 6. Responsive behavior

Tested at **1440, 1024, 768 and 390px**.

- **≥1024:** hero is split (copy on 7 columns, calculator on 5). The exchange flow has the form on the left and a sticky quote summary on the right.
- **768–1023:** hero stacks with the calculator full width under the copy. The exchange summary moves above the step actions.
- **<768:** single column with 16px gutters. Navigation collapses into a disclosure menu button with `aria-expanded`. Tables become stacked definition rows. The quote summary collapses into a "You receive $X" bar placed above the continue button. No horizontal scroll at 390px.

## 7. Motion

Motion explains a change; it never decorates. (v1 allowed only hover and focus transitions. In October 2026 the owner asked for a livelier "terminal" feel that stays clear to everyone, so the rules below replace that.)

- **Allowed:** opacity and transform moves of 120–500ms that point at what changed:
  - **Price tape** (home and `/exchange`): a changed reference price flashes its cell once and shows ▲/▼ with the change. Neutral ink colors, never red/green trading colors. Labelled MOCK.
  - **Rolling digits** on "You receive": only the digits that changed roll into place (~0.35s). The final value renders at once and is what assistive tech reads; nothing counts up from zero.
  - **Rate-hold ring** on the review step: a small ring empties with the quote timer and turns warning-colored under 15 seconds, next to the same countdown in text.
  - **Hold to confirm** for the irreversible exchange: press and hold for one second with a fill showing progress; releasing early cancels. Enter, Space or a click without a pointer confirms immediately, so keyboard and screen-reader users are never blocked.
  - **Status rail and event log** on `/transactions/:id`: a newly reached step draws its connector and settles its dot; the current step pulses softly. New log lines type in left to right; the full text is in the DOM from the start.
- **Not allowed:** looping decorative animation, parallax, counting money up from zero, motion that is the only carrier of a state (state is always also in text), anything longer than 0.5s except the one-second hold and the quote countdown.
- **Reduced motion:** with `prefers-reduced-motion: reduce` every one of these is off (GSAP tweens run inside `gsap.matchMedia()` with `REDUCED_OK` from `src/lib/motion.ts`; CSS animations have a reduce override). The hold-to-confirm fill still runs, because it is the feedback for an ongoing press, not decoration.
- **Implementation:** GSAP core and `useGSAP` via `@/lib/motion` (no plugins in shared UI). First render is always static; only updates animate.

## 8. Mock-data labelling rules (non-negotiable)

1. A sitewide preview banner sits above the header on every page: *"Preview environment — prices, quotes, verification and transactions are simulated. No real funds move."*
2. Every price, quote, receipt and status screen carries a visible **MOCK** badge.
3. Deposit "addresses" are deliberately **invalid strings** (`MOCK-…`), so no real funds can be sent to them by mistake. QR codes are not rendered.
4. Simulation controls (advance transaction state) sit in a clearly fenced "Mock controls" panel.
5. Verification results say "Simulated result".

## 9. Accessibility targets

WCAG 2.2 AA. Text contrast at least 4.5:1 (3:1 for large text and UI boundaries). Full keyboard operability. A skip link. Landmarks. One H1 per page. Labelled form fields. Status changes announced via polite live regions. Targets at least 44×44px on touch. Automated axe scans run against each page as part of QA (see `docs/implementation-status.md`).
