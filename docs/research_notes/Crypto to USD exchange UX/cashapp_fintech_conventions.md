# Cash App and Premium US Consumer Fintech Conventions (Design Research for an Original Crypto-to-USD Exchange)

> **Method and access caveat (read first).** Research date: 2026-10-13. Direct page fetches failed. The egress proxy denied `cash.app:443` by organization policy, and WebFetch/curl could not resolve or reach abduzeedo.com, shadcn.io, designcompass.org, nerdwallet.com, dfs.ny.gov or web.archive.org. Every finding below therefore comes from **search-engine result summaries and snippets** of the cited URLs, not from reading the full pages. Treat quoted wording as close to the source but **not verified verbatim**. Before reusing any exact phrase, figure or layout claim in a spec, re-check it against the live page. Cash App changes its fees and copy often. Third-party fee and "how-to" sites in the results were often low quality or spammy and are excluded unless noted.

## 1. How does cash.app's marketing site present itself (headline style, typography, color, imagery, layout rhythm, CTA patterns, nav and footer IA)?

### Takeaway
Cash App's visual identity is built on one loud brand green, a custom typeface (Cash Sans, introduced in a late-2025 redesign) and a large custom icon set. The marketing pages reportedly use green as their **single accent** and give **one feature per section**. I could not retrieve the exact current homepage headline, CTA labels, nav or footer.

### Cited Findings
- In late 2025 Cash App launched a new design language together with "Moneybot", an AI financial assistant. The update bundled more than 150 product improvements, and coverage called it the biggest change since launch. — [Design Compass, Dec 3 2025](https://designcompass.org/en/2025/12/03/cash-apps-new-design-language-and-ai-moneybot/)
- The redesign introduced a custom typeface, **Cash Sans**, described as "perfectly balancing the brand's personality and clarity." — [Abduzeedo](https://www.abduzeedo.com/cash-apps-new-design-language-and-ai-assistant-moneybot)
- The signature green was pushed brighter: "the signature brand color goes even bolder—like digital phosphor." The redesign also added "650+ new icons", custom motion and haptics, and a refreshed grid and shape system. Lauren LoPrete is credited as Head of Design Systems. — [Abduzeedo](https://www.abduzeedo.com/cash-apps-new-design-language-and-ai-assistant-moneybot)
- Community-derived style files give **conflicting** hex values for the green: "Cash Green #00e013" in one, and "electric #00d54b green on near-black" in another. Neither is official. — [shadcn.io DESIGN.md (community)](https://www.shadcn.io/design/cashapp); [webdesignhot DESIGN.md (community)](https://www.webdesignhot.com/design.md/cash-app/)
- The webdesignhot listing tags Cash App's style as "dark · vibrant · sans · mono · neon · youth · p2p". — [webdesignhot](https://www.webdesignhot.com/design.md/cash-app/)
- Cash App's brand-guidelines site was built by Index Studio on the Standards platform. It covers the typeface, motion and tone of voice, and opens with "an immersive, custom-built experience." — [standards.site](https://standards.site/examples/cash-app)
- A landing-page review says the consumer marketing page uses green as its single accent color and builds each section around one feature. — [landing.love](https://www.landing.love/sites/cash/)
- An earlier 2023–2024 illustration and identity system called "Evergreen" was a separate project, by Buck. — [Buck case study](https://www.buck.co/work/cash-app-visual-identity)

### Inferences
- The pattern is restraint with one exception: a mostly neutral or dark canvas, one saturated brand accent, and a single idea per viewport-height section. A crypto-to-USD site can borrow this rhythm (one claim and one proof per section) without copying the green or the type.
- Cash App invested in a proprietary typeface. A premium-feeling original site should choose one distinctive but highly legible family, with true tabular figures (see Q5), rather than a default system font.
- A neon-on-dark, youth/P2P vibe fits Cash App's audience. A cash-out product that handles larger sums may want a calmer palette. Use the accent for primary actions and positive states only, never for decoration around numbers.

### Gaps
- Exact current homepage H1/subhead, CTA labels (for example "Get Cash App" or "Download"), nav items, and footer link groups and footer legal text could not be retrieved because cash.app was blocked. A direct visit is needed.
- Official hex values, type scale, spacing and radii are unconfirmed. Only community approximations exist.
- Imagery style (photography vs. 3D vs. illustration) on the current site is unverified.

## 2. How does Cash App let users sell bitcoin for USD: amount entry, fee display, exchange-rate/spread disclosure, confirmation, receipts?

### Takeaway
The flow is short: Money tab → Bitcoin tile → **Sell** → preset amount or custom amount → PIN/Touch ID → **Confirm**. Costs come in two parts, a tiered **service fee** and a variable **spread** (the sale price is marked down from market). Both are shown on the **confirmation screen before the user commits**.

### Cited Findings
- Official flow: from the Money tab, tap the Bitcoin tile, tap Sell, pick a preset amount or enter a custom amount, then "Enter your PIN or Touch ID and tap Confirm." — [Cash App Help: Selling Bitcoin](https://cash.app/help/us/en-us/3102-selling-bitcoin)
- Two cost components: a **service fee** plus a **spread**. On a sale the spread is applied as a markdown, and it appears on the confirmation screen before you finalize. — [Cash App Help: Bitcoin Pricing](https://cash.app/help/3103)
- The spread range is stated inconsistently across Cash App's own pages. One says "may be anywhere between 0% and 1%, depending on market conditions" ([Help 3103](https://cash.app/help/3103)), and another says "Depending on market conditions, the spread may be anywhere between 0% and 0.75%" ([cash.app/bitcoin/fees](https://cash.app/bitcoin/fees)). **Conflict. Verify on the live page.**
- The service fee is tiered and falls as trade size rises. Snippets show "$2,000.01 – $3,000 | 1.25%", "$3,000.01 – $5,000 | 1%" and ">$5,000.01 | 0.75%". Tiers under $2,000 were cut off in the snippet. — [Cash App Help: Bitcoin Pricing](https://cash.app/help/3103)
- The fees page advertises zero fees and zero spread for Auto Invest, Round Ups, direct-deposit purchases and buys over $2,000. These are **buy** contexts, not sells. — [cash.app/bitcoin/fees](https://cash.app/bitcoin/fees)
- NerdWallet notes that because of the spread, "you'll sell for slightly below market value." Its worked example is a $200 purchase with roughly $4 in fees. — [NerdWallet](https://www.nerdwallet.com/article/investing/cashapp-crypto)
- A third-party guide (lower reliability) says the confirmation page shows "transaction details, including transaction fees and the total amount you will receive," and that a confirmed sale cannot be reversed. — [Techpoint Africa](https://techpoint.africa/guide/how-to-convert-bitcoin-into-cash-using-cash-app/)
- Bitcoin **withdrawal** (sending BTC on-chain, as opposed to selling) has a fee schedule that is "calculated when the order is placed," with "any fee … shown on the transaction confirmation screen before you complete the transaction." — [Cash App Help: Bitcoin Withdrawals](https://cash.app/help/3106-bitcoin-withdrawals)

### Inferences
- **Pattern to borrow:** have one decisive moment, the confirmation screen, where every cost is itemized and the final "You receive $X.XX" is the hero number. Gate it with a deliberate confirm action, and state irreversibility near the button.
- Cash App mixes a percentage fee with a variable spread. A spread is less transparent because it is embedded in the price. An original exchange can stand out by showing the **market reference rate vs. your rate** explicitly, or by quoting one all-in rate with the implied cost in dollars.
- Presets plus custom entry is the standard amount-entry pattern. For a web product, a large centered amount field with a USD/crypto toggle and quick-pick chips (for example 25% / 50% / Max) gives the same mental model without copying the mobile keypad.
- A quote that can change ("depending on market conditions") calls for a **quote expiry/refresh** indicator on the confirmation step.
- Cash App's own pages disagree on the spread range. This is a lesson in itself: keep one canonical fee source rendered everywhere so disclosures can't drift.

### Gaps
- How the big-number keypad looks and behaves (font size, $ prefix, how the BTC equivalent is shown, decimal handling) could not be observed. cash.app was blocked, and no reliable screenshot write-up was found.
- Whether Cash App shows a live quote countdown on sell confirmation is unverified.
- The receipt/activity-detail layout after a sale (fields shown, exchange rate recorded) is unverified.
- The fee tiers for sales under $2,000 were not visible.

## 3. How does Cash App describe payout/transfer speeds (standard vs. instant) and the fees for each? What hedging language do they use?

### Takeaway
Cash App frames payout speed as a **user choice between free-and-slower and paid-and-fast**. Standard is free, in "1–3 business days". Instant costs a percentage fee with a minimum. Bitcoin withdrawals use named tiers (Standard / Rush / Priority) with target times hedged as "or less", and the network fee is an "estimate".

### Cited Findings
- Cash-out speed: standard transfers are free and arrive "within 1-3 business days". Instant transfers cost a "0.5% - 1.75% fee (with a minimum fee of $0.25)". — [Cash App Help: Cash Out Speed Options](https://cash.app/help/3073-cash-out-speed-options); the same range appears on [Cash App Fees](https://cash.app/cardfees)
- **Conflict:** a third-party help article says Cash App lists 0.5%–2.5%, with a $0.25–$1 minimum and a $75 maximum. This could not be confirmed against official pages. — [eco.com support article](https://eco.com/support/en/articles/17345344-cash-app-fees-2026-instant-deposit-atm-and-business-charges)
- Bitcoin withdrawal tiers: **Priority**, "10 minutes or less", network fee plus up to $3. **Rush**, "2 hours or less", network fee plus up to $2. **Standard**, "24 hours or less", no fee. — [Cash App Help: Bitcoin Withdrawals](https://cash.app/help/3106-bitcoin-withdrawals)
- Hedging on network fees: actual network fees "may differ from the estimate," and Cash App "may sometimes charge more than the estimate during volatile periods." — [Cash App Help: Bitcoin Withdrawals](https://cash.app/help/3106-bitcoin-withdrawals)
- Minimums: the Standard bitcoin withdrawal minimum is shown as both "100,000 Satoshis" and "0.001 bitcoin", which are the same amount. Rush and Priority have a 0.00005 BTC minimum. Lightning withdrawals can be "fast and free". — [Cash App Help: Bitcoin Withdrawals](https://cash.app/help/3106-bitcoin-withdrawals)

### Inferences
- Speed is presented as a **choice with the price attached to each option**, which suits a radio-card selector ("Standard – Free – 1–3 business days" vs. "Instant – 1.5% (min $0.25) – usually minutes").
- Speed claims are always phrased as a target or range ("within 1–3 business days", "10 minutes or less"), never as a guarantee. An original exchange should copy that discipline: "typically", "usually within", "estimated", plus a footnote on what can delay a payout (bank holidays, compliance review, network congestion).
- "Business days" is the standard US term for ACH-style payouts and should be used literally, with weekends and holidays excluded.
- Fees should appear in **both % and $** at the moment of choice, so the user never has to calculate the cost.

### Gaps
- The exact current instant-deposit wording (for example whether it says "instantly" or "typically within minutes") could not be read verbatim.
- Whether the instant fee has a maximum cap is unresolved (conflicting sources).

## 4. What legal disclosures appear, and where are they placed?

### Takeaway
Cash App relies on a repeated, formulaic disclosure stack. It says (1) it is a financial services platform, not a bank, (2) banking is provided by named partner banks, with FDIC pass-through coverage only on certain balances, (3) bitcoin services are provided by Block, Inc., with New York-specific licensing language, and (4) bitcoin and investments are not FDIC insured. Block publishes its NMLS ID and state licenses on a dedicated licenses page.

### Cited Findings
- Official social posts carry the boilerplate: "Cash App is a financial services platform, not a bank. Banking services provided by Cash App's bank partner(s)…" followed by partner-bank language (Wells Fargo Bank, N.A., Member FDIC) about savings interest. — [Cash App on X](https://x.com/CashApp/status/1953845077861969932?lang=en)
- A disclosure variant reproduced by third parties reads: "Cash App is a financial services platform, and not an FDIC-insured bank." Pass-through insurance language reads: "Your balance is eligible for FDIC pass-through insurance through our Program Banks Wells Fargo Bank, N.A. and/or Sutton Bank, Members FDIC," up to $250,000 per customer if conditions are met. These are secondary copies. — [Money Crashers](https://www.moneycrashers.com/bank-cash-app/); [BankBonus](https://bankbonus.com/guides/what-bank-is-cash-app)
- Partner-bank roles: Sutton Bank issues the Cash Card. Lincoln Savings Bank's role is **disputed** across sources. — [BankBonus](https://bankbonus.com/guides/what-bank-is-cash-app); [SlashGear](https://www.slashgear.com/1496733/what-bank-does-cash-app-use/)
- Cash App has a dedicated explainer page, "Is Cash App a Bank?". — [Cash App Learn](https://cash.app/learn/getting-started/is-cash-app-a-bank)
- Bitcoin licensing language: "Block, Inc. operates in New York as Block of Delaware and is licensed to engage in virtual currency business activity by the New York State Department of Financial Services." Some bitcoin features (for example Stablecoin, Bitcoin Map, Lightning) are noted as unavailable to New York residents. — [Cash App press release](https://cash.app/press/cash-unlocks-bitcoin-everyday-stablecoins)
- Brokerage separation: "Cash App Investing LLC, member FINRA/SIPC, subsidiary of Block, Inc." The disclosures also state that Cash App Investing does not trade bitcoin and that Block, Inc. is not a member of FINRA or SIPC. — [Cash App Affiliate Disclosures](https://cash.app/legal/us/en-us/affiliate); [Cash App Podcast Disclosures](https://cash.app/legal/ca/en-us/podcast)
- Volatility language (press release): bitcoin's value can change rapidly, so the amount of bitcoin needed for a purchase, or the amount made from an investment, "may vary." — [Cash App press release](https://cash.app/press/cash-unlocks-bitcoin-everyday-stablecoins)
- Help center: investments in stocks and bitcoin through Cash App are not FDIC insured. — via search summary of [Cash App Learn](https://cash.app/learn/getting-started/is-cash-app-a-bank)
- Block's money transmitter NMLS ID is **942933**. Block publishes a state-by-state table of license numbers and notes that its Indiana money transmitter license does not cover virtual currency. — [Block Legal: Licenses](https://block.xyz/legal/licenses); [Maine consent order](https://www.maine.gov/pfr/consumercredit/enforcement/enforcement_item.shtml?id=13145196). (The brief's "1552064" could not be confirmed.)
- Regulatory context: a multistate BSA/AML settlement of about $80M, with 48 state agencies, in January 2025 — [Nevada FID](https://www.business.nv.gov/news-media/press-releases/2025/financial-institutions/state-of-nevada-joins-80-million-enforcement-action-against-block-inc-cash-app-for-bsa-aml-violations/); [CSBS](https://www.csbs.org/node/521836). A $40M NYDFS penalty in April 2025 required an independent monitor. — [NYDFS](https://www.dfs.ny.gov/reports_and_publications/press_releases/pr202504101); [The Block](https://www.theblock.co/post/350412/jack-dorseys-block-inc-settles-for-40-million-with-ny-regulator-over-aml-failures)
- FDIC Part 328 (amended by a December 2023 final rule) bars misrepresenting deposit insurance by "any person." It adds crypto-assets to the "non-deposit product" definition and calls it a "material omission" for a nonbank to fail to clearly and conspicuously identify the insured bank(s) it works with. — [FDIC notice](https://www.fdic.gov/system/files/2024-07/2023-12-20-notice-dis-b-fr.pdf); [KPMG summary](https://kpmg.com/us/en/articles/2023/fdic-deposit-insurance-signage-and-advertising-final-rule-reg-alert.html)
- Regulators point consumers to NMLS Consumer Access to confirm that a company is licensed in their state. — [Nevada FID](https://www.business.nv.gov/news-media/press-releases/2025/financial-institutions/state-of-nevada-joins-80-million-enforcement-action-against-block-inc-cash-app-for-bsa-aml-violations/)

### Inferences
- **Placement pattern:** a short "not a bank / services provided by [entity]" line runs everywhere (site footer, social posts, press releases). Full detail lives on dedicated legal pages (licenses table, affiliate disclosures, explainer article). A new exchange should copy this two-tier structure: a persistent footer line plus a linked licenses page listing the legal entity, the NMLS ID and per-state license numbers or status.
- **Name the legal entity that provides the crypto service** (Cash App says "provided by Block, Inc."). State-specific carve-outs (New York, and states where the service is unavailable) belong in the disclosures and in eligibility gating.
- Under Part 328, a crypto-to-USD site should **never** imply that crypto balances or in-flight funds are FDIC insured. If any USD is held at a partner bank, the bank must be named clearly and conspicuously, and pass-through coverage must be described with its conditions.
- Cash App's public enforcement history shows that compliance is scrutinized. Avoid marketing claims such as "fully regulated" or "licensed in all 50 states" unless they are literally true and linked to evidence.

### Gaps
- The exact cash.app footer disclosure text and its placement order on the homepage and the /bitcoin page could not be read.
- The full current bitcoin risk-disclosure paragraph (for example "Bitcoin is not legal tender…") was not retrievable verbatim. The phrase "Bitcoin is a volatile…" was not found.
- Whether the sell confirmation screen itself carries in-flow legal copy is unverified.
- The current status (2025–2026) of the FDIC digital-signage requirements for IDIs is unconfirmed.

## 5. What general conventions do premium US fintechs use for large figures, form states/validation, error/empty/loading states, accessibility, and avoiding unsupported trust claims?

### Takeaway
I found little authoritative, product-specific documentation from Robinhood, Wealthfront, Mercury or Stripe. Search surfaced none. The general conventions are well established in design-system and accessibility guidance: tabular numerals for money, inline errors that are short, specific and fix-oriented, programmatic error association (aria-invalid / aria-describedby), no reliance on color alone, and no deposit-insurance or regulatory claims that cannot be substantiated.

### Cited Findings
- `font-variant-numeric: tabular-nums` enables the OpenType `tnum` feature (equal-width digits). `lnum` gives lining figures and `pnum` proportional figures. — [CSS Portal](https://www.cssportal.com/css-properties/font-variant-numeric.php)
- A fintech brand system (Dash) applies tabular numerals to money columns via a `.tabular-nums` utility and shows how proportional digits make rows look ragged. — [Dash brand: data viz / tabular numerics](https://brand.dash.fi/foundations/data-viz)
- Equal-width figures line up vertically, which helps readers scan financial data. — [Microsoft Docs: FontNumeralAlignment](https://learn.microsoft.com/en-us/dotnet/api/system.windows.fontnumeralalignment?view=net-8.0)
- If a font lacks `tnum`, the browser silently falls back, so font choice must be verified. Inter, IBM Plex Sans and Source Sans 3 are cited as having tabular figures (single blog source). — [fontalternatives.com](https://fontalternatives.com/blog/best-fonts-legible-numerals-ui/)
- A claimed "2025 Type Network study" showing that tabular figures raise trust could not be located. **Unverified. Do not cite.** — [pravinkumar.co](https://www.pravinkumar.co/blog/tabular-numbers-webflow-pricing-tables-b2b-2026)
- Inline errors should be "brief, written in sentence case, and visible immediately upon a form input that is not valid," and should "describe specific solutions." — [Shopify Polaris: Inline error](https://polaris.shopify.com/components/selection-and-input/inline-error)
- Validation timing: validate general fields on blur, apply a 300–500 ms delay for formatted fields, and once an error shows, re-validate on each keystroke so it clears as soon as the input is fixed. Use `aria-invalid` and `aria-describedby`, and pair color with text or icons. — [Reform: accessible form validation](https://www.reform.app/blog/accessible-form-validation-best-practices)
- Move focus to the first error after a failed submit. An error summary at the top and inline errors are both valid, depending on form complexity. Avoid vague messages such as "Invalid input." — [Reform: accessible error messaging](https://reform.app/blog/accessible-form-error-messaging-best-practices/)
- Trust-claim guardrails: FDIC Part 328 prohibits misrepresentation of deposit insurance by any person, including nonbanks and crypto firms, and prohibits misuse of the FDIC name or logo. — [Sheppard Mullin](https://www.sheppard.com/insights/blogs/fdic-and-cfpb-take-action-to-protect-against-misrepresentations-about-fdic-insured-status-and-misuse-of-name-and-logo); [FDIC notice](https://www.fdic.gov/system/files/2024-07/2023-12-20-notice-dis-b-fr.pdf)
- Cash App itself uses pre-commit confirmation screens that show all fees, and hedged estimates for variable costs. — [Cash App Help 3103](https://cash.app/help/3103); [Cash App Help 3106](https://cash.app/help/3106-bitcoin-withdrawals)

### Inferences
- **Numbers:** render every money value with tabular, lining figures. Make the hero amount (amount entry and "You receive") much larger than body text, with a smaller, de-emphasized currency symbol and cents. Use a fixed decimal policy: 2 dp for USD, and up to 8 dp for BTC with trailing zeros trimmed in secondary displays. Prefix negatives and fees with a minus sign and a label, not color alone.
- **Amount field states:** empty (placeholder "$0" in a muted color), typing (live crypto/USD equivalent below), below minimum or above balance or above limit (a specific inline message naming the limit, for example "Minimum sell is $10.00"), quote loading (skeleton or spinner on the "You receive" figure only, never on the whole form), quote expired (an inline "Rate updated — review new amount" that requires reconfirmation).
- **Error tone:** plain, blame-free sentences that say what happened and the next step ("Your bank declined this transfer. Try another account or contact your bank."). Avoid codes unless paired with human copy.
- **Empty states:** for example, no transactions yet. Give one sentence of explanation and one primary action.
- **Accessibility:** announce quote changes politely via `aria-live`, make sure amount inputs have explicit labels including currency, and meet a 4.5:1 contrast ratio, which is especially relevant if using a neon-green-on-dark aesthetic like Cash App's.
- **Trust claims:** prefer verifiable specifics (legal entity name, NMLS ID with a link to NMLS Consumer Access, named bank partner, a fee table) over adjectives ("bank-level security", "fully insured", "guaranteed instant"). Never use the FDIC name or logo near crypto balances.

### Gaps
- No primary design documentation from Robinhood, Wealthfront, Mercury or Stripe was retrieved (searches returned nothing relevant, and fetches were blocked). Their specific amount-input, loading and error conventions remain unverified.
- No reliable source was found on Cash App's own handling of empty, loading or error states, or on its accessibility conformance.
