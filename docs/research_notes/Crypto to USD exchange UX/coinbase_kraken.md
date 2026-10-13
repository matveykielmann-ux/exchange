# Coinbase and Kraken: marketing site and sell/cash-out UX (design research, US perspective, Oct 2026)

> **Method and verification caveat (read first).** The session's egress policy blocked direct access to every relevant host (www.coinbase.com, help.coinbase.com, www.kraken.com, support.kraken.com, blog.kraken.com, review sites, web.archive.org); WebFetch and curl both failed with DNS errors or 403 CONNECT denials. The research was not routed around the block. Everything below comes from **web-search result snippets and the search engine's summaries of the pages listed**. The URLs are the pages those snippets came from, but **no page was opened and read in full**, and no screens were seen directly. Wording shown in quotation marks is snippet text and may be cut off. Treat every item as "indexed text, not visually verified." Anything about layout, spacing, or how screens look is listed as a gap unless a snippet said it.

## 1. Homepage positioning and top-level IA

### Takeaway
Kraken's 2026 homepage, as indexed, opens with a short emotional headline ("Own the power of your money"), adds a social-proof tag ("Most popular crypto exchange 2026"), and then broadens scope with "Crypto and stocks made easy." Both brands now present themselves as multi-asset "money" platforms rather than crypto-only exchanges. The Coinbase homepage hero could not be verified.

### Cited Findings
- Kraken homepage (search-index snapshot, Oct 2026): the headline is "Own the power of your money," with a "Most popular crypto exchange 2026" line and the subhead "Crypto and stocks made easy." — [Kraken homepage](https://www.kraken.com/)
- Kraken's menu groups "Buy crypto," "Buy stocks," and "Auto-invest in crypto" under its product section. "Buy crypto" was confirmed as a **nav item**. The hero CTA label was not confirmed. — [Kraken homepage](https://www.kraken.com/); [Kraken Pro](https://pro.kraken.com/)
- Kraken's app-store name is "Kraken: Buy Crypto & Stocks," which reinforces the multi-asset positioning. — [Google Play](https://play.google.com/store/apps/details?id=com.kraken.invest.app&hl=en_US)
- Kraken runs separate surfaces by audience: Kraken Pro ("Advanced Trading Platform for Crypto, Stocks & Futures"), /institutions (OTC), and a separate consumer money app, Krak (krak.app). — [Kraken Pro](https://pro.kraken.com/); [Krak](https://krak.app/); [Kraken OTC contact](https://www.kraken.com/institutions/otc/contactform)
- Coinbase: the search turned up no indexed homepage hero text. A June 2026 Coinbase blog post is titled "System Update: Take Control of Your Money with Coinbase," which points to "money/control" messaging. That is not confirmed as the homepage hero. — [Coinbase Blog](https://www.coinbase.com/blog)
- In June 2026 Coinbase launched "AI agent accounts that can trade and spend on your behalf," which shows how far the product has grown past buy/sell. — [CoinDesk](https://www.coindesk.com/tech/2026/06/11/coinbase-launches-ai-agent-accounts-that-can-trade-and-spend-on-your-behalf)
- Coinbase keeps separate audience hubs: /institutional (Coinbase Institutional) and /prime (Prime custody). — [Coinbase Institutional](https://www.coinbase.com/institutional); [Coinbase Prime Custody](https://www.coinbase.com/prime/custody)
- Both sites run large SEO page families for each asset: Coinbase uses `/price/{asset}`, and Kraken uses `/prices/{asset}`, `/buy/{asset}`, and `/learn/sell-{asset}-ach`. Kraken has pages built around a specific intent, such as "Sell [asset] via ACH." — [Coinbase price page example](https://www.coinbase.com/price/metahero); [Kraken prices example](https://www.kraken.com/prices/metahero); [Kraken buy example](https://www.kraken.com/buy/hero); [Kraken "Sell … ACH" learn page](https://www.kraken.com/learn/sell-alchemy-pay-ach)

### Inferences
- The market leaders now sell "your money" and broad scope rather than "crypto." A focused crypto-to-USD product can stand apart with one job, stated plainly, for example "Sell crypto. Get dollars."
- Kraken's `/learn/sell-{asset}-ach` pages show there is search demand for the specific asset-to-payout-rail query. Consider landing pages for each asset and each payout rail.
- Both brands split retail, pro, and institutional into separate products or subdomains. A product serving both retail and large tickets needs a clear fork early in the IA, such as "Over $50k? Talk to our desk."

### Gaps
- Coinbase's 2026 hero headline, CTA labels, any email-capture field, and the order of homepage sections could not be verified.
- Neither site's full top-nav labels or footer column structure could be verified. The only confirmed nav items are Kraken's "Buy crypto," "Buy stocks," and "Auto-invest in crypto."
- How much of each homepage is live product (price tickers, quote widgets) versus marketing was not verified.

## 2. Sell / cash-out conversion journey

### Takeaway
Both platforms split cashing out into **two separate transactions**: (1) sell crypto into a USD balance, then (2) withdraw USD to a bank. Each step has its own preview and confirmation. Fees show on a preview screen before confirming, but the **spread is built into the quoted price** and is not shown as its own line. Coinbase reveals it through a tooltip. Kraken's confirmation page shows a "full fee breakdown." Neither consumer flow is documented with a visible quote countdown. Coinbase Prime's RFQ uses a documented short price hold of 3 seconds in the UI.

### Cited Findings
**Coinbase**
- Fees "are calculated when you place an order" and can be seen "on the trade preview screen before submitting." For the spread, users "tap the tooltip next to your asset's price line item to view the spread." — [Coinbase pricing and fees disclosures](https://help.coinbase.com/en/coinbase/trading-and-funding/pricing-and-fees/fees)
- Coinbase "may retain any excess spread," and no fixed spread is published on its help page. NerdWallet reports Coinbase has historically described the spread as about 0.5% (secondary source). — [Coinbase fees disclosures](https://help.coinbase.com/en/coinbase/trading-and-funding/pricing-and-fees/fees); [NerdWallet](https://www.nerdwallet.com/investing/reviews/coinbase)
- The Coinbase fee and the 1% limit-order fee are disclosed "in the price details or fee breakdown on the order preview screen." — [Coinbase fees disclosures](https://help.coinbase.com/en/coinbase/trading-and-funding/pricing-and-fees/fees)
- Cash-out flow: choose Cashout, pick the payment method, enter amount and asset, then confirm. The sale and the bank transfer appear as **separate transactions**. A third-party cash-out option costs about 2–3% (Base app context). — [Coinbase Help: Sell or cash out from the Base app](https://help.coinbase.com/en/wallet/managing-account/sell-cash-out); [Coin Bureau guide](https://coinbureau.com/guides/how-to-withdraw-money-on-coinbase)
- Eligible US customers can use instant cashouts to RTP-enabled bank accounts. Standard ACH is free but slower: 3–5 business days per one guide, 1–3 per another (sources conflict). Wires cost about $10–25 (third-party figure). — [Coinbase Help: Instant Cashouts](https://help.coinbase.com/en/coinbase/getting-started/add-a-payment-method/instant-cashout); [Coin Bureau](https://coinbureau.com/guides/how-to-withdraw-money-on-coinbase); [Wizely Finance](https://wizelyfinance.com/knowledge-hub/how-to-cash-out-on-coinbase/)
- The bank account name must match the Coinbase profile, and limits vary by verification level and region (viewable in Settings). — [Coin Bureau](https://coinbureau.com/guides/how-to-withdraw-money-on-coinbase)
- Coinbase's developer price API notes that "exchange rates fluctuate so the price is only correct for seconds," and that the sell-price endpoint "includes standard Coinbase fee (1%) but excludes any other fees including bank fees." — [Coinbase Developer Docs: Prices](https://docs.cdp.coinbase.com/coinbase-app/track-apis/prices)
- Coinbase Prime RFQ: "UI price hold is 3 seconds," the quote can be refreshed up to 20 times, and the API hold is 1 second. If not accepted, the quote "expires… and a new quote would need to be requested." — [Coinbase Help: RFQ on Coinbase Prime](https://help.coinbase.com/en/prime/trading-and-funding/rfq)
- Coinbase stock trading (equities, not crypto): NBBO refreshes every 10 seconds, and a **Refresh** control sits on the order confirmation screen. This shows a refresh pattern Coinbase already uses. — [Coinbase Help: NBBO and pricing transparency](https://help.coinbase.com/en/trading-and-funding/pricing-and-fees/nbbo-pricing-transparency)
- If Coinbase closes an account, the user cannot sell crypto for cash but can still withdraw the existing cash balance. — [Coinbase Help: Withdraw from closed account](https://help.coinbase.com/en/coinbase/managing-my-account/other/how-to-withdraw-funds-from-a-closed-account)

**Kraken**
- App sell steps: tap **+**, then **Sell**, pick the coin from your assets, enter the amount in cash or crypto terms, tap **Continue** to review, then **Confirm**. "The cash will be added to your balance in the default currency." — [Kraken Support: Buying, selling and converting with the Kraken app](https://support.kraken.com/articles/360058727972-buying-selling-and-converting-cryptocurrency-with-the-kraken-app)
- The final confirmation page shows a "full fee breakdown," and the fees shown depend on the payment method. — [Kraken app FAQ](https://support.kraken.com/articles/360049744652-kraken-app-frequently-asked-questions)
- App-store copy promises users can "get an exact price quote before you buy or sell." — [App Store: Kraken](https://apps.apple.com/us/app/-/id1481947260)
- US USD withdrawal rails, from Kraken's cash-withdrawal table and ACH article: **ACH free, 0–2 business days**, processed Mon–Fri, same day if submitted before 2 PM ET and under $1M; **Fedwire $4 fee, $20 minimum, 0–1 business days**. The bank account must be in the same legal name. Not available to New York residents for ACH. — [Kraken Support: Cash withdrawal options](https://support.kraken.com/articles/360000423043-cash-withdrawal-options-fees-minimums-and-processing-times-); [Kraken Support: ACH withdrawals](https://support.kraken.com/articles/4408922630676-ach-withdrawals)
- **Instant USD withdrawals** (launched March 2026): arrive in minutes, 24/7/365, with a fee of **1.5%, capped at $50**. Free ACH remains for users who are not in a hurry. — [Kraken Blog](https://blog.kraken.com/news/instant-usd-withdrawals); [Business Wire](https://secure.businesswire.com/news/home/20260318274418/en/Kraken-Launches-Instant-USD-Withdrawals-Available-247365)

### Inferences
- The two-transaction model (sell, then withdraw) is an industry habit carried over from exchange architecture, and the Base-app article says outright that the two appear separately. An "instant crypto-to-USD" product can collapse this into **one quote → one confirm → one status tracker** that ends with "USD arrives in your bank." This is likely the biggest structural difference available.
- Payout speed is now sold as a tiered product: free ACH (slow), wire (flat fee), and instant (about 1.5%, capped). Show the rail choice next to its exact cost and arrival time, for example "Instant · $X fee · minutes" versus "ACH · free · 1–2 business days." The $50 cap shows that large-ticket users expect capped fees.
- Coinbase's spread-in-a-tooltip draws recurring criticism: NerdWallet says costs "can be difficult to track." A clear opportunity is to show **mid-market rate, your rate, total cost in USD and %, and you receive** on the main quote card rather than in a tooltip.
- The Prime 3-second hold and the "refresh up to 20 times" pattern suggest a design for large tickets: short firm quote, visible countdown, one-tap requote.

### Gaps
- Consumer quote-expiry timers, countdown UI, and exact preview line-item labels ("You receive," "Total," etc.) could not be verified for either retail app.
- Post-transaction status screens (receipts, progress trackers, notifications) were not documented in any accessible snippet.
- Coinbase instant-cashout fee percentages and minimums were not verified, because the article was not readable.

## 3. Deposit network selection, wrong-network warnings, confirmations

### Takeaway
Both platforms support a single asset on many networks (Kraken lists 11 for USDT). Coinbase preselects a default network and makes the user acknowledge risk before switching. Kraken shows network, minimum, and required confirmations for each asset on its deposit screen. Confirmation thresholds are not published consistently in sources that could be reached.

### Cited Findings
- Coinbase: for assets on several networks, the default network is preselected and can be changed in a network field. Coinbase then asks the user to **confirm they understand the risk** of sending on a different network. The same network must be used on both ends, except for the Polygon/Ethereum case. A related article, "Automatic return for unsupported network transactions," exists but was not read. — [Coinbase Help: Assets on multiple networks](https://help.coinbase.com/en/coinbase/trading-and-funding/sending-or-receiving-cryptocurrency/assets-on-multiple-networks)
- Coinbase added SOL deposits and withdrawals on Base (Dec 2025), letting SOL move between Solana and Base. — Search summary; original source not identified with confidence. **Unverified.**
- EVM chains (Ethereum, Base, etc.) share 0x address formats, so a pasted address can be valid on the wrong chain with no obvious error. Solana's Base58 format is visibly different. Confirmed sends cannot be reversed at the protocol level. — [Copperx: USDC recovery (third-party)](https://copperx.io/learn/usdc-recovery)
- Kraken USDT networks: Arbitrum One, Avalanche C-Chain, Ethereum, Flare, Ink, Optimism, Polygon, Solana, The Open Network, Tron, Unichain. — [Kraken Support: Stablecoins supported on Kraken](https://support.kraken.com/articles/stablecoins-supported-on-kraken)
- Kraken USDT on Tron: about 20 confirmations, with a reported minimum of 5 USDT (third-party). USDT on Ethereum: 30 confirmations (older guide) versus 20 (newer page). This **conflicts and is unresolved**. — [TradingFinder: Kraken TRC20](https://tradingfinder.com/exchanges/kraken/tether-trc20-deposit/); [TradingFinder: Kraken ERC20](https://tradingfinder.com/exchanges/kraken/tether-erc20-deposit/); [eco.com USDT confirmation times](https://eco.com/support/en/articles/15247703-usdt-confirmation-time-by-network-2026)

### Inferences
- Patterns worth adapting in original form: (a) preselect the cheapest or most common network, (b) require an explicit acknowledgment before switching, (c) show **network badge + chain-specific address + minimum deposit + confirmations/ETA** together on the deposit card, (d) visually separate EVM networks because they share an address format (for example, a large network label next to the QR code and repeated in the copy-confirmation toast).
- An "automatic return for unsupported network" safety net, as Coinbase appears to offer, is a trust feature worth considering and naming plainly.

### Gaps
- Exact warning copy, modal design, and whether QR codes include the network name could not be seen for either platform.
- USDC network lists and confirmation counts for Coinbase and Kraken were not verified.

## 4. Fee / pricing pages

### Takeaway
Kraken publishes a fee-schedule page for each product (Instant Buy 1%, custom orders 1.5%, Pro maker/taker tiers, card surcharge 3.75%). Coinbase points users to a help-center "pricing and fees disclosures" article and the preview screen rather than a flat headline rate. Both keep the right to retain "excess spread," and neither publishes a fixed spread.

### Cited Findings
- Kraken's fee schedule lists 1% for instant and recurring trades and 1.5% for custom orders. Kraken+ members can have the trading fee waived on up to $10,000 per month. — [Kraken Fee Structures](https://www.kraken.com/features/fee-schedule); [Kraken app FAQ](https://support.kraken.com/articles/360049744652-kraken-app-frequently-asked-questions)
- An older Kraken schedule had 0.9% for stablecoins and 1.5% for other crypto on instant buy. Card purchases add 3.75%. ACH via Plaid has no processing fee. — [Bankrate](https://www.bankrate.com/investing/kraken-review)
- Third-party all-in estimates for Kraken's simple app: about 2% (1% fee plus about 1% spread). Kraken Pro starter tier: 0.25% maker / 0.40% taker, possibly changed July 2026. — [Yahoo Finance review](https://finance.yahoo.com/personal-finance/investing/review/kraken-review-130000202.html); [CryptoRyancy](https://www.cryptoryancy.com/kraken-fees-complete-guide-2026/); [Datawallet](https://www.datawallet.com/crypto/kraken-fees-explained)
- Krak, Kraken's money app, has its own pricing page. — [Krak Pricing](https://krak.app/pricing)
- Coinbase's beginner-interface figures of 0.40% maker / 0.60% taker are reported by a third party. Advanced Trade or Coinbase One reduces fees by 75–95% (third-party). — [Coin Bureau Coinbase review](https://coinbureau.com/review/coinbase-review)

### Inferences
- Neither leader shows the full all-in cost of a sell as one number on a public page. A public **fee calculator** for an original product (enter amount and rail, get spread %, fee, and USD received) would be a real point of difference, consistent with the review criticism.
- Volume tiers and caps (Kraken+ waiver up to $10k per month, $50 instant-withdrawal cap) show that pricing structure itself works as marketing for both retail and high-volume users.

### Gaps
- The layout of either fee page (tables, tabs, calculators, footnotes) could not be seen.

## 5. Large-volume / OTC / institutional offerings

### Takeaway
Kraken publishes a concrete **$50,000 OTC minimum** and a self-serve contact form that asks for the trade (base currency, quote currency, amount). Coinbase routes large flows into Coinbase Prime and Institutional, with no published minimum, negotiated pricing, and KYB onboarding.

### Cited Findings
- Kraken OTC minimum lowered from $100K to **$50K** (March 2025 blog). Exceptions are considered case by case. Some Kraken pages, such as the USDC OTC page, still say $100K. — [Kraken Blog: OTC $50K minimum](https://blog.kraken.com/news/otc-50k-minimum); [Kraken OTC contact form](https://www.kraken.com/institutions/otc/contactform); [Kraken USDC OTC](https://www.kraken.com/features/otc-exchange/usdc)
- The Kraken OTC form asks for **base currency, quote currency, and amount** for a quote. Chat trading has no maximum size, and higher limits require verified clients. Trading is subject to AML/KYC. A self-service RFQ is also available. — [Kraken OTC contact form](https://www.kraken.com/institutions/otc/contactform); [Kraken Support: Introducing the Kraken OTC Desk](https://support.kraken.com/articles/360021967711-introducing-the-kraken-otc-desk); [Kraken Blog](https://blog.kraken.com/news/otc-50k-minimum)
- Kraken also lists crypto-backed loans under /institutions (Canada page seen). — [Kraken OTC lending](https://www.kraken.com/ca/institutions/otc-lending)
- Coinbase Prime RFQ: 3-second UI quote hold, up to 20 refreshes. — [Coinbase Help: RFQ](https://help.coinbase.com/en/prime/trading-and-funding/rfq)
- Coinbase Prime: fees and minimums are not published and are negotiated by volume. Third parties cite conflicting figures ($1,000 onboarding fee; "typically starts at $500,000"; "no strict minimum"), all **unverified**. Onboarding is application, then KYB and compliance review. — [Cryptoworth](https://blog.cryptoworth.com/what-is-coinbase-prime-custody/); [Fensory](https://fensory.com/insights/protocols/coinbase-prime); [G2](https://www.g2.com/products/coinbase-prime/pricing)
- Coinbase publishes onboarding document requirements for **high-net-worth individuals**, including source-of-wealth proof. — [Coinbase Help: HNWI onboarding](https://help.coinbase.com/en/business-onboarding/documents/hnwi)
- Coinbase's historical OTC desk is "agency-only," and all counterparties must clear KYC/AML. — [Coinbase Blog](https://www.coinbase.com/blog/announcing-new-features-and-services-to-make-trading-easier-for-high-volume-customers-in-asia-and)

### Inferences
- Kraken's form, which starts from the trade itself (asset, currency, amount), lowers effort compared with a generic "contact sales" form. For an original US product, a "Get a large-trade quote" form that begins with *what you want to sell and how much* and then asks qualifying details (entity vs. individual, source of funds, payout rail) fits large retail tickets.
- Publishing a concrete threshold ($50K at Kraken) sets user expectations. Coinbase's unpublished terms work for institutions but leave high-net-worth individuals unsure. A public, mid-range threshold with "exceptions considered" copy is a reasonable pattern.

### Gaps
- The full field list and qualifying questions on the Coinbase Institutional/Prime "contact sales" form could not be verified.
- Kraken form fields beyond base, quote, and amount were not verified.

## 6. Visual language

### Takeaway
Coinbase: a single saturated blue accent (#0052FF) on white and near-black, with the custom Coinbase Sans and Coinbase Display typefaces from the 2022 Moniker rebrand; display headings are reportedly set at regular weight (400) rather than bold. Kraken: a purple accent (about #7132F5 / #5741D8), with reported custom "Kraken-Brand" (display) and "Kraken-Product" (UI) families and about 12px button radius. Most of this comes from third-party design-token reverse-engineering, not official sources.

### Cited Findings
- Coinbase brand blue #0052FF is used mainly for primary CTAs and the logo, as the single accent on white and near-black surfaces. — [shadcn.io Coinbase design summary](https://www.shadcn.io/design/coinbase); [Refero styles](https://styles.refero.design/style/df5e2be4-c2bd-42bb-bbc7-409bae6355c3)
- Coinbase Sans is a custom typeface created by Moniker in the 2022 rebrand for use across all applications. — [Creative Review](https://www.creativereview.co.uk/monikersf-coinbase-rebrand/)
- Coinbase Display is reported as the H1/H2 headline face at weight 400. One source instead claims Coinbase uses a system font stack, so the **sources conflict**. — [shadcn.io](https://www.shadcn.io/design/coinbase); [designmd.co](https://www.designmd.co/d/coinbase); [OpenDesign](https://open-design.ai/plugins/design-system-coinbase/)
- Kraken purple #7132F5 is reported as primary for CTAs and links, with #5741D8 and #5B1ECF for outlines and deep accents. Logo purple is cited as #5841D8. Two families, "Kraken-Brand" (display) and "Kraken-Product" (UI), are reported, with a fallback to IBM Plex Sans. Buttons have about 12px radius. — [shadcn.io Kraken design summary](https://www.shadcn.io/design/kraken); [getdesign.md Kraken](https://getdesign.md/kraken/design-md); [Mobbin Kraken colors](https://mobbin.com/colors/brand/kraken)
- Sources conflict on whether Kraken surfaces are white with purple accents (marketing) or dark with purple accents (trading UI). This likely reflects marketing versus Pro. — [oh-my-design Kraken](https://oh-my-design.kr/design-systems/kraken)

### Inferences
- Both leaders own a single strong accent hue (blue, purple) and stay restrained elsewhere. An original brand should avoid both hues and avoid copying either face. A neutral grotesk with tabular figures, plus a distinctive accent (for example, a green or ink tone that signals "cash"), would stand apart.
- Light display weights at large sizes (the reported Coinbase Display 400) suggest calm confidence rather than shouting. Worth testing for big USD figures on a quote card.

### Gaps
- Figure sizes, spacing density, imagery or illustration style, and number formatting (tabular figures, USD decimals, thousands separators) could not be observed because no pages or screenshots were accessible. These need a direct visual audit.

## 7. Trust and compliance disclosure

### Takeaway
Both make state money-transmitter licensing the backbone of their trust messaging, through dedicated licenses/disclosures pages that list each state. Both explicitly say crypto is **not** FDIC/SIPC protected. Coinbase uses careful "pass-through" wording for USD cash balances; Kraken's US entity uses a short "not a member of FINRA/SIPC and not FDIC insured" line.

### Cited Findings
- Coinbase Licenses & Disclosures page: lists NMLS ID 1163082 (Coinbase, Inc.), with entries for each state and complaint contacts, including NYDFS Consumer Assistance. It states virtual currency is not government-backed, and account and value balances are not covered by FDIC, NCUA, or SIPC. — [Coinbase Licenses & Disclosures](https://www.coinbase.com/legal/licenses)
- Coinbase USD balances: held in pooled custodial accounts at FDIC- or NCUSIF-insured institutions, with **pass-through** coverage "up to the per-depositor limit" ($250,000) that depends on accurate records and the receiver's determination. Coinbase is not itself an FDIC-insured bank. — [Coinbase User Agreement (US)](https://www.coinbase.com/legal/user_agreement/united_states); [Coinbase Insurance](https://www.coinbase.com/legal/insurance)
- Third-party sites overstate this, for example "USD balances are FDIC-insured up to $250,000; licensed in all 50 states." That is less precise than Coinbase's own conditional wording. — [wealthvieu.com](https://wealthvieu.com/banking/coinbase/is-safe/)
- Kraken: US money transmission is through **Payward Interactive, Inc.** The Disclosures page lists state licenses with complaint contacts. Kraken says it holds MTLs in 46 US jurisdictions and is registered with FinCEN as an MSB. NMLS 1843762 is reported (third-party and Krak pages). — [Kraken Disclosures](https://www.kraken.com/legal/disclosures); [How Kraken is regulated](https://www.kraken.com/learn/how-kraken-is-regulated); [TrueBroker](https://truebroker.net/brokers/kraken/); [Krak](https://krak.app/)
- Kraken's US line: "Crypto trading within the U.S. is offered by and through Payward Interactive, not a member of FINRA/SIPC and not FDIC insured." — [Kraken Social Media Disclosure](https://www.kraken.com/social-media-disclosure)
- Kraken Disclosures: "Digital assets and Kraken accounts are not covered by insurance against losses. They are not subject to [FDIC] or [SIPC] protections in the United States." The EEA wording is "Crypto trading involves risk of loss." — [Kraken Disclosures](https://www.kraken.com/legal/disclosures); [Kraken EU Risk Disclosure](https://eu.kraken.com/legal/risk-disclosure)
- Krak app: Payward Interactive "is not a bank." The virtual account is "not a deposit account and is not FDIC insured," with funds held in a pooled Citibank account. — [Krak](https://krak.app/); [App Store: Krak](https://apps.apple.com/us/app/krak-money-app-card/id6738051700)
- Kraken Financial page footer shows NMLS ID 2429615 for Payward Financial, Inc. (index about 2.5 years old, may be stale). — [Kraken Financial](https://www.kraken.com/financial)
- Historical context: in a 2022 Connecticut consent order, Kraken was found unlicensed for money transmission in CT at that time. The 2023 SEC complaint against Payward is also public. — [CT DOB consent order](https://portal.ct.gov/-/media/DOB/Enforcement/Consumer-Credit/2022-CC-Orders/Payward-Ventures-dba-Kraken-CO.pdf); [SEC press release 2023-237](https://www.sec.gov/news/press-release/2023-237)
- Kraken ACH withdrawals are not available to New York residents (an eligibility carve-out shown in support docs). — [Kraken Support: ACH withdrawals](https://support.kraken.com/articles/4408922630676-ach-withdrawals)

### Inferences
- **What they do not claim:** neither says crypto holdings are insured. Neither publishes a fixed spread, and both reserve the right to keep "excess spread." Coinbase avoids saying "FDIC insured" outright and uses conditional "pass-through" wording. Kraken's Krak wording says "not a bank" directly. An original product should take the same care: never imply FDIC coverage for crypto, and qualify any USD pass-through claim exactly.
- Pattern: name the licensed entity (not just the brand), give an NMLS ID, and link to a state-by-state licenses page with complaint contacts. Kraken's 46 jurisdictions plus a NY carve-out show that state availability belongs in the UX itself, such as a state selector or eligibility check early in onboarding, not only in legal pages.
- Brand vs. entity: Kraken separates brand (Kraken), US entity (Payward Interactive), and bank-like entity (Payward Financial). Footers and receipts should name the entity that actually performs the transaction.

### Gaps
- The exact footer legal text and its placement on either homepage (font size, link density, which disclosures appear sitewide) could not be verified.
- Whether NMLS IDs appear in sitewide footers, as opposed to only on the legal pages, was not verified for either company.
- Coinbase's current number of licensed jurisdictions was not verified from a primary source.
