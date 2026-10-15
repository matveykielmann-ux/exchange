# Crypto Exchange UI Design Trends (Behance / Dribbble) — Patterns to Adopt vs. Clichés to Avoid

Research date: 2026-10-13. Purpose: design research for an ORIGINAL premium US crypto-to-USD exchange site (warm white / deep navy / restrained emerald).

**How this was researched, and its limits (read first):** The two named galleries could not be fetched. WebFetch returned DNS failures (`getaddrinfo ENOTFOUND dribbble.com` / `www.behance.net`), and a direct `curl` was refused by the sandbox egress proxy (`CONNECT tunnel failed, response 403`, logged as `connect_rejected` for both hosts). The same block applied to every other site tried (lazarev.agency, material.io, and others), so **no page in these notes was read directly**. Every finding comes from WebSearch result summaries and snippets. Where a summary named a specific Dribbble or Behance profile or shot, it is cited with its URL, but its visual details were not checked by eye. No shot details are invented here. Several design-system sources are unofficial third-party write-ups (for example shadcn.io, refero, open-design, webdesignhot "DESIGN.md" files), and they are marked as such.

---

## Q1. Which visual tropes dominate crypto exchange galleries, and which signal a "generic crypto template"?

### Takeaway
The galleries and the commentary about them lean heavily on one look: dark canvases, neon or purple-teal gradients, glassmorphism and 3D glass coins. Commentators call this look fast to read as "crypto" but interchangeable. For a US fiat off-ramp it signals "token launch / speculative trading", not "regulated money movement", so the brief is right to avoid it.

### Cited Findings
- A 2026 Web3 wallet concept on Contra pairs a dark UI with neon accents. A Speckyboy roundup of crypto-inspired UI concepts singles out "dominant dark tones" plus "gorgeous gradients" and card layouts. — [Contra](https://contra.com/p/FNO3P2bA-just-wrapped-up-this-futuristic); [Speckyboy](https://speckyboy.com/crypto-inspired-design-concepts/)
- Dribbble profiles surfaced by search carry tags that match the tropes:
  - "Dark Theme Crypto Trading Bot UI — Neon, Liquid Glass & Clay" and "Liquid Glass Wallet – Dual Theme Landing Page" — [Creative_Web_Guru on Dribbble](https://dribbble.com/Creative_Web_Guru)
  - "Crypto token project landing page & branding", tagged dark mode and glassmorphism — [vyco on Dribbble](https://dribbble.com/vyco)
  - "Crypto 3D Icon Scenes", tagged 3D, Blender, dark mode — [y-uu on Dribbble](https://dribbble.com/y-uu)

  Seen as search listings only; not checked visually.
- Gradient libraries market teal-to-violet gradients (e.g., #67EEEC to #9D4AEB) as built for "crypto exchange dark-mode dashboards". — [Pixeliro](https://pixeliro.com/gradients/cool--67eeec-9d4aeb--radial-315)
- An unofficial dYdX design spec describes a pure-black canvas with one saturated indigo-purple (#7774ff) kept for the primary action. This shows purple on black is the default "pro exchange" vocabulary. — [webdesignhot dYdX spec](https://www.webdesignhot.com/api/design-md/dydx/claude.md)
- 99designs says vibrant purple, orange or green in front of a deep black background is a "go-to" way for crypto brands to stand out, and that many crypto logos use circles to suggest coins. — [99designs](https://99designs.com/blog/web-digital/cryptocurrency-design/)
- A1 Gallery's roundup of 37 Web3 sites says crypto sites lean into "bold, futuristic aesthetics with dark backgrounds, neon accents, and 3D rendered visuals". It adds that the stronger designs explain complex concepts simply. — [A1 Gallery](https://www.a1.gallery/category/crypto)
- Stock libraries hold tens of thousands of "crypto neon" assets and "3D glass holographic bitcoin/ethereum/solana coin" renders. The imagery is commoditized. — [Shutterstock "crypto neon"](https://www.shutterstock.com/search/crypto-neon)
- A critique of glassmorphism says "frosted cards floating over neon gradients started appearing on Dribbble" quickly, and that "blur isn't depth": the style looks current without adding clarity. — [Medium / Design Bootcamp](https://medium.com/design-bootcamp/glassmorphism-the-most-beautiful-trap-in-modern-ui-design-a472818a7c0a)
- Lazarev (an agency) frames 2026 crypto sites as moving from dense monitoring dashboards toward decision-support "control rooms", with wallet-first personalization. — [Lazarev](https://www.lazarev.agency/articles/best-crypto-website-design) (agency opinion)
- A March 2026 piece citing community discussion says many crypto platforms still look dated, and polished, intuitive experiences are rare. — [Coinspectator](https://coinspectator.com/mainstream/2026/03/14/the-best-crypto-native-ui-youve-seen-lately/) (anecdotal)
- Micro-interactions that confirm send/receive and trade actions are cited as an established pattern (Coinbase Wallet, Robinhood). — [Merge.rocks](https://merge.rocks/blog/crypto-design-10-creative-ideas-and-trends-to-watch) (2024 article)
- AR/VR in Web3 is described as speculative and early-stage. — [Plexus](https://www.plexusrs.com/evolution-of-design-crypto/)

### Inferences
Classification for this product (my synthesis from the above):

**Clichés to avoid.** Each one signals "generic crypto template":
- A black or near-black canvas as the default theme.
- Purple, violet or teal neon gradients, especially behind hero text or as button fills.
- Glassmorphism: frosted cards over gradient blobs.
- Floating 3D or glass coin renders and "coin on podium" hero art.
- Glowing outlines and neon text shadows.
- Hero sections with candlestick or line charts, and decorative sparklines on a product that does not trade.
- Mosaics of many small stat cards ("24h volume", "users", "TVL"), and ticker tapes.
- Rows of partner or exchange logos without real agreements behind them.
- "Bank-grade security" badges and shields with nothing verifiable behind them.

**Worth adopting** (but restyled):
- Single-purpose, decision-focused layouts. In the "control room" idea, keep only the decision support and drop the dashboard density.
- Subtle confirmation micro-interactions on submit, copy and status changes.
- Clean card grouping, used sparingly: one primary surface per screen, not a mosaic.
- Plain-language explanation of crypto concepts. A1 Gallery names this as what separates the stronger sites.

A light theme is itself a differentiator in this category, because the dominant vocabulary is dark plus neon.

### Gaps
- I could not view Behance or Dribbble result grids, so I cannot give counts or proportions (e.g., "X% of shots are dark mode"). All "dominance" claims rely on secondary commentary and tags.
- No authoritative 2026 industry survey of crypto UI trends was found. The sources are agency blogs, roundups and listings.

---

## Q2. Well-executed patterns for amount input with currency selector, asset/network picker, quote/fee rows, step indicators, status timelines, and address/QR deposit screens

### Takeaway
The credible patterns come from production products and design-system documentation, not from gallery shots. They are:
- network chosen together with the token, and before an address is shown;
- the fee shown as its own line before confirmation;
- an ordered status timeline with a summary pill, where "pending" never looks like "failed";
- an accessible stepper (`aria-current="step"`, text plus icon, 3 to 5 steps).

### Cited Findings
**Swap / convert widget and token + network picker**
- In a former designer's case study, Uniswap's token selector was redesigned to handle tokens across networks in one unified interface. It was the first component shared across web, mobile wallet and extension. — [fredz.website case study](https://www.fredz.website/projects/swap)
- In Uniswap, the network choice sits inside the token-selection step: users "can switch networks when selecting the token". — [Uniswap Help: swap on different networks](https://support.uniswap.org/hc/en-us/articles/11306088153485-How-to-swap-on-different-networks-in-the-Uniswap-Wallet); [Uniswap Help: switch networks](https://support.uniswap.org/hc/en-us/articles/11045742405517-How-to-switch-networks)
- Tokens can be searched by name or by contract address. The same ticker on two chains is two different assets, and wrong-network confusion is the most common cause of "my balance is missing". — [defi-intel guide](https://defi-intel.com/tutorials/how-to-swap-on-uniswap/) (third-party)
- A Uniswap GitHub issue asked for a way to view the selected token's details (address, explorer link) from any state of the UI. — [Uniswap/interface #790](https://github.com/Uniswap/interface/issues/790)
- Embeddable swap widgets (thirdweb, Uniswap, Rubic) all expose light and dark themes or theme objects. A light swap widget is a supported, mainstream configuration. — [thirdweb SwapWidget](https://portal.thirdweb.com/references/typescript/v/SwapWidget); [thirdweb iframe](https://portal.thirdweb.com/bridge/swap-widget/iframe); [Uniswap widget theme](https://docs.uniswap.org/sdk/swap-widget/reference/v2); [Rubic widget](https://docs.rubic.finance/integrate-widget/instruction)

**Quote / fee breakdown**
- Wise uses the mid-market rate and charges a separate, visible service fee. Its comparison page lists the fee as a line item next to the rate, rather than hiding cost in the spread. Third-party reviews describe the fee as "shown before confirmation". — [Wise compare](https://wise.com/compare/); [Pound Sterling Live review](https://www.poundsterlinglive.com/best-exchange-rates/providers/wise)
- Wise offers a guaranteed rate only for some currencies. How that appears in the UI was not confirmed. — [Wise compare](https://wise.com/compare/)

**Address / QR deposit screen**
- Show the currency, the network and the minimum deposit on the deposit form. A deposit sent in the wrong currency or on the wrong network "can be lost or difficult to recover". Provide both a copy button and a QR code. — [CryptoProcessing: design payment form](https://docs.cryptoprocessing.com/deposits/design-payment-form)
- Bitso has users choose the matching network first. Only then do the deposit address and QR code appear. It generates a fresh address after each deposit and warns users not to reuse saved addresses. It flags required destination tags or memos (e.g., XRP). — [Bitso deposit help](https://support.bitso.com/hc/en-us/articles/4415146069780-Deposit-crypto-to-your-Bitso-account)
- Wallet guides recommend a pre-send checklist: confirm the network, verify the address, include any memo. — [MyTonWallet help](https://help.mytonwallet.io/intro/introduction-to-crypto-and-mytonwallet/crypto-addresses-explained)

**Step indicators**
- Put `aria-current="step"` on the active step. Status must have its own text, because a visual-only checkmark is never announced; pair the icon with a label such as "Step 2, Profile, current". — [Telerik/Kendo stepper a11y](https://www.telerik.com/kendo-react-ui/components/layout/stepper/accessibility/wai-aria-support); [UX4G stepper](https://ux4g.gov.in/components/stepper); [Brio stepper](https://bitanical.codeberg.page/brio/extras/stepper/); [Singapore GovTech stepper](https://v2dev.designsystem.tech.gov.sg/components/stepper)
- Use an ordered list so screen readers announce the sequence. Red Hat recommends 3 to 5 steps, and says a stepper should complement previous/next navigation, not replace it. — [Pluma stepper a11y](https://pluma.customer.io/components/stepper/accessibility); [Red Hat progress stepper](https://ux.redhat.com/elements/progress-stepper/); [Red Hat progress steps](https://ux.redhat.com/components/progress-steps)
- Step indicators need at least 4.5:1 contrast and must stay legible at 200% zoom. Combine marker and label into one tab stop. — [Toyota CDS stepper a11y](https://dx-playbook-prev.toyota-europe.com/cds/components/forms/stepper-pages/accessibility/)
- Use color plus an icon, never color alone. — [UX4G stepper](https://ux4g.gov.in/components/stepper)
- Sources disagree on the container role: a `nav` landmark (Kendo), no ARIA because it is decorative (Kendo React), or `role="progressbar"` (UX4G). — [Telerik](https://www.telerik.com/kendo-react-ui/components/layout/stepper/accessibility/wai-aria-support); [UX4G](https://ux4g.gov.in/components/stepper)

**Transaction status timeline**
- Render the transaction as an ordered timeline:
  - completed steps ticked;
  - the in-progress step active;
  - upcoming steps muted;
  - the overall status as a pill above the stepper.

  Spendfigo's stages are received, debited, processing, sent, delivered, with failed and reversed as terminal states. — [Spendfigo transaction lifecycle](https://docs.spendfigo.com/documentation/transaction-lifecycle)
- Never mark a pending payment as failed, because it may still complete. Use a distinct "processing" state. — [mctaba (Paystack pending)](https://mctaba.com/learn/paystack/pending-transactions-handling-the-paystack-grey-zone)
- Status vocabularies differ between providers (e.g., Inswitch "waiting/pending/finished/reverted/cancelled"). A UI should map them onto its own small set of user-facing labels. — [Inswitch transaction status](https://docs.inswitch.com/docs/transaction-status)
- A good status label names the state, implies the next likely change and suggests the right action, in plain consumer words ("pending", "posted"). — [Transaction status wording](https://bikes.fan/corpus/gen-967/professional-communication/transaction-status-wording.html) (low-quality source; opinion)

### Inferences
Concrete, original component direction for this product (synthesis, not copied from any shot):

**Convert widget**
- Use one surface: a white card on the warm-white canvas, with a 1px warm-gray border and no shadow or only a very soft one.
- Stack it vertically:
  1. **"You send"**: a large amount input on the left. On the right, a compact asset chip (token icon, ticker, and the network as a small secondary line, e.g. "USDC · Ethereum").
  2. A small swap-direction divider.
  3. **"You receive"**: USD, shown as a large read-only figure.
  4. The quote breakdown.
  5. The primary CTA.
- **Large figure handling.** The input uses tabular, lining numerals at display size (about 40 to 48px desktop, 32 to 36px mobile) in navy. The currency code sits beside the number in a smaller, lighter weight. A placeholder "0.00" sits in a tertiary tone. Show the USD equivalent of the crypto amount on a secondary line beneath it.
- **Validation sits inline under the input.** Examples: "Minimum 25 USDC", "Exceeds available balance". Do not use toasts.

**Token + network picker**
- Open it as a modal sheet on mobile or a popover on desktop.
- Put the search field first; it accepts a name, ticker, or a pasted contract address.
- Below it, a short "Supported assets" list, with each row showing icon, name and ticker, then a network sub-row or segmented control.
- Treat network as a first-class choice. Once a token is picked, show its supported networks right away, ideally as radio rows that say what matters for a sell flow, e.g. "Network fee ~$0.40 · ~2 min". Wording must be qualified ("est.", "~"), never guaranteed.
- Show the contract address, truncated, with an explorer link in the picker row details. This addresses the gap raised in Uniswap issue #790.
- Do not show price charts or 24h % change inside the picker. This is an off-ramp, not a trading terminal.

**Quote breakdown**
- Use a quiet definition list of label and value rows, with labels in secondary navy-gray and values right-aligned in tabular numerals:
  - Rate (1 USDC = $0.9998)
  - Network fee (est.)
  - Service fee
  - **You receive**: the emphasized total row, separated by a hairline rule.
  - Quote expires in 0:28
- The fee is always a separate line, never folded into the rate (the Wise pattern).
- Use a countdown or "refresh quote" affordance for time-limited quotes. Mark estimated values "est." with an info tooltip that explains them.

**Step indicator**
- Use 3 to 4 steps for the sell flow, e.g. Amount → Payout account → Review → Send crypto.
- Show it as a horizontal numbered list on desktop and as "Step 2 of 4 · Payout account" text on mobile.
  - Completed steps: an emerald check plus a text label.
  - The current step: navy, filled.
  - Upcoming steps: an outline in tertiary gray.
- Apply the cited accessibility rules (`aria-current="step"`, an ordered list, text labels).

**Status timeline (after the user sends crypto)**
- Use a vertical timeline with a summary pill above it ("Processing", "Completed", "Action needed"). Stages could be:
  1. Waiting for deposit
  2. Deposit detected (0/N confirmations)
  3. Confirmed
  4. Converting to USD
  5. Payout sent
  6. Arrived (est. date)
- Show a timestamp next to each finished stage, and an explorer link on the detection and confirmation stages.
- Keep "pending/processing" visually distinct from failure. Use neutral or info styling, never red.
- Only terminal failure or reversal states get the error color, and each comes with a next action (e.g., "Contact support with reference #…").

**Deposit screen**
- Sequence: network confirmation first, then the address.
- Above the address, show a large, unmissable "Send only USDC on Ethereum" line with the network named in words.
- Show the address in a monospace or tabular face, chunked into groups of 4 characters for checking, with a copy button that confirms "Copied".
- Place the QR next to it on desktop and behind a toggle on mobile. Show the minimum deposit, and the memo or tag if required, with its own copy button.
- Add a calm (not alarming) note that a wrong-network deposit may be unrecoverable.
- Do not decorate the QR code with gradients or logos that reduce scan reliability.

### Gaps
- I found no Behance or Dribbble shot that is confirmed to be a light-theme swap widget. The search surfaced a "DeFi application / light mode" profile ([thatpollen](https://dribbble.com/thatpollen?page=2)), a "Digital Currency Exchange Dashboard with Light and Dark Modes" ([OceanSad](https://dribbble.com/OceanSad)) and a "Cryptocurrency Spot Exchange" ([AntonioSujo](https://dribbble.com/AntonioSujo)), but I could not view them.
- I found no published research comparing quote-breakdown layouts (e.g., expanded vs. collapsed fee rows) for conversion or trust.
- How Wise visually presents the guaranteed-rate window in its UI was not confirmed.

---

## Q3. Typefaces and type scales in the higher-quality, restrained concepts, and how large figures are handled

### Takeaway
Premium fintech brands pair a distinctive (often proprietary) display face with a neutral grotesque, usually Inter or similar, for functional UI. They give large figures tabular, lining numerals so balances do not shift as digits change. Exact values from the unofficial design-system write-ups conflict and must not be copied as specs.

### Cited Findings
- **Wise.** Wise Sans (proprietary) at weight 900 with very tight leading (about 0.85) is the display face; heroes are reported at about 64 to 126px (one audit measured about 105px with −3.15px tracking). Inter handles functional UI. One summary of official guidance says to use Wise Sans for "short, high-impact moments" and default to Inter for most product communication. Sources conflict on how widely Wise Sans is used. — [refero Wise](https://styles.refero.design/style/367c0c6e-73a7-441c-a8ff-91d139ac60dc); [shadcn.io Wise](https://www.shadcn.io/design/wise); [design-skills Wise DESIGN.md](https://github.com/ItamarZand88/design-skills/blob/main/design-md/wise/DESIGN.md); [Fudge audit of wise.com](https://design.withfudge.com/share/wise.com-design) (all unofficial)
- **Mercury.** Arcadia (proprietary geometric grotesque) is used for UI, sometimes split into ArcadiaDisplay and Arcadia, and Tiempos (serif) is used for editorial voice. A blog reports a 480 headline weight and a 1.625 body line-height as deliberate choices. Another file lists body at 420 with +0.42px tracking on display sizes. Sources also disagree on whether Mercury's canvas is light or dark. — [Blake Crosley on Mercury](https://blakecrosley.com/guides/design/mercury); [shadcn.io Mercury](https://www.shadcn.io/design/mercury); [refero Mercury](https://styles.refero.design/style/3172cd4d-118a-4a16-a259-6b634d32322e) (unofficial; conflicting)
- **Coinbase.** Third-party summaries describe CoinbaseDisplay for heroes, CoinbaseSans for UI and CoinbaseText for body. One light-theme preview lists Display at 80px/400 with line-height 1.0, section headings at 36px/400, and buttons at 16px/600. They also list a white background, #0a0b0d foreground and #0052ff accent. One guide says Coinbase has historically used fixed-width digits for figures so changing balances do not shift layout; this is the author's reasoning, not a documented rule. — [hagicode Coinbase light preview](https://design.hagicode.com/previews/coinbase/light); [open-design Coinbase](https://open-design.ai/plugins/design-system-coinbase/); [madegooddesigns](https://madegooddesigns.com/coinbase-font/); [webdesignhot Coinbase](https://www.webdesignhot.com/design.md/coinbase/) (unofficial)
- **Tabular numerals.** `font-variant-numeric: tabular-nums` maps to OpenType `tnum` and gives every digit the same width, so columns align. `lining-nums` puts all numerals on the baseline. Support has been broad across browsers since January 2020. — [MDN font-variant-numeric](https://developer.mozilla.org/docs/Web/CSS/font-variant-numeric)
- Inter, Geist, Söhne, Manrope, Roboto and SF Pro ship tabular figures. Scope `tabular-nums` to figures and tables rather than applying it globally, because running text loses its proportional rhythm. — [pravinkumar.co](https://www.pravinkumar.co/blog/tabular-numbers-webflow-pricing-tables-b2b-2026) (secondary)

### Inferences
Original type direction for this product:
- **Avoid proprietary faces.** Wise Sans, Arcadia and Coinbase faces are not licensable, and imitating them would undercut originality.
- **Use one neutral grotesque with strong tabular figures for UI and numbers.** Inter, or Geist, is open source and ships `tnum`.
- **Optional editorial accent.** A restrained serif with high-quality numerals (open-licensed options exist, e.g. Source Serif 4, Newsreader, Fraunces in a calm setting) used only for marketing H1s and section headlines. This echoes Mercury's grotesque-plus-serif split without copying it. Never set financial figures in the serif.
- **Suggested scale.** A 1.2 to 1.25 ratio from a 16px base: 12 / 14 / 16 / 18 / 22 / 28 / 36 / 48 / 64. Marketing H1 at 56 to 64px desktop and 36 to 40px mobile, at weight 500 to 600 (not 900), letter-spacing about −1 to −2%, line-height about 1.05 to 1.1. Body text 16px with line-height 1.5 to 1.6.
- **Large financial figures.**
  - Display numbers (e.g., "You receive $9,842.17") at 40 to 48px, weight 500 to 600, with `font-variant-numeric: tabular-nums lining-nums` and slight negative tracking.
  - Set the currency symbol at the same size and the currency code (USD, USDC) at about 40 to 50% size in secondary color.
  - Make cents optionally lighter, never smaller to the point of being unreadable.
  - Right-align numbers in tables and breakdown rows. Never truncate amounts with ellipses.
  - Use thousands separators, and use a consistent number of decimals per asset (USD 2; stablecoins 2 for display, with the full precision available on hover or details).
- **Use monospace only for addresses, transaction hashes and reference IDs.** Do not use it for amounts.

### Gaps
- No official, first-party published type specs for Wise, Mercury or Coinbase were retrieved. All values come from unofficial write-ups that conflict with each other.
- I could not check which typefaces appear in individual Behance or Dribbble shots.

---

## Q4. Are there light-theme, restrained "bank-grade" concepts, and what makes them feel credible?

### Takeaway
Yes. Light themes are well represented among finance brands that sell calm and trust. Credibility comes from:
- disciplined spacing and hierarchy;
- a restrained palette with one purposeful accent;
- a noise-free transaction flow;
- clear fee transparency;
- not inventing social proof. For a US company, fake reviews and testimonials are also a legal liability under the FTC's 2024 rule.

### Cited Findings
- An audit-style analysis of finance app themes reports that where a brand sells calm and trust, light is "equally well-represented". Dark tends to suit brands that lean on one saturated accent. — [LazyLanding Labs research](https://lazylanding-labs.onrender.com/research/what-theme-do-finance-apps-launch-with.md) (methodology not checked)
- Fintech agencies attribute trust to:
  - calming blues, grays and whites;
  - consistent spacing and purposeful color;
  - "zero visual noise in the transaction flow";
  - clear hierarchy and generous white space so dense data stays scannable.

  — [The Skins Factory](https://www.theskinsfactory.com/uiux-design-blog/fintech-ui-ux-design); [The Alien Design](https://www.thealien.design/insights/fintech-ui-design) (agency opinion)
- Binance.US is described as using white surfaces "for trust" with dark panels for depth, alternating light and dark sections. — [opendesigner Binance](https://opendesigner.io/design-systems/binance) (unofficial)
- Counterpoint: some prominent fintechs (e.g., Revolut Business) lean dark, and power-user finance tools increasingly default to dark. — via search summary of [The Skins Factory](https://www.theskinsfactory.com/uiux-design-blog/fintech-ui-ux-design) and related results
- A Coinbase light-theme preview pairs a white background with a near-black foreground (#0a0b0d) and a single blue accent (#0052ff). This is a restrained, one-accent light system at a major US crypto company. — [hagicode Coinbase light preview](https://design.hagicode.com/previews/coinbase/light) (unofficial)
- Behance lists crypto exchange case studies (e.g., "XanPool – Cryptocurrency Exchange UI UX case study", 2019; "Simplex — A Beginner Crypto Exchange App Case Study"), but none were confirmed to be light or minimal. — [Behance XanPool](https://www.behance.net/gallery/81385727/XanPool-Cryptocurrency-Exchange-UI-UX-case-study); [Behance "exchange app" search](https://www.behance.net/search/projects/exchange%20app)
- **FTC rule on fake reviews and testimonials.** The FTC finalized a rule on Aug 14, 2024 banning fake or false reviews and testimonials, including AI-generated ones. It also covers company-controlled review sites posing as independent, and fake social-media indicators. It allows civil penalties against knowing violators of about $51,744 per violation (2024 figure, inflation-adjusted periodically). — [FTC press release](https://www.ftc.gov/news-events/news/press-releases/2024/08/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials); [Davis Wright Tremaine](https://dwt.com/insights/2024/08/ftc-finalizes-rule-banning-fake-consumer-reviews); [Hunton](https://hunton.com/hunton-retail-law-resource/ftc-issues-final-rule-targeting-fake-consumer-reviews-and-testimonials-including-those-generated-by-artificial-intelligence-ai-and-online-bots)

### Inferences
Credibility levers that replace the avoided tropes:
- **Specific, verifiable facts instead of trust badges.** Examples: registration or licensing language only if true and checkable; supported assets and networks named exactly; explicit fee formula; payout timing given as ranges with "est.".
- **Show the product, not illustrations.** A real, legible convert widget in the hero, pre-filled with a sample amount, does more than any 3D coin.
- **Typographic hierarchy over containers.** Use section headings and whitespace to group content instead of stacking decorative cards. Use one card per functional unit (widget, quote, timeline) only.
- **Honest empty states.** No logo walls, testimonials or user counts until real ones exist. The FTC rule makes fabricated testimonials a concrete legal risk, not just a taste issue.
- **No charts unless they answer a user question.** For a sell flow, the only number that matters is "what will I receive and when".

### Gaps
- I found no rigorous empirical study (A/B or survey) showing that light themes outperform dark for perceived trust in crypto specifically. The light-equals-trust link is supported only by practitioner opinion and audits.
- The LazyLanding Labs methodology and sample could not be checked (the fetch was blocked).
- Whether the FTC fake-review rule has been amended or challenged since 2024 was not checked.

---

## Q5. Concrete direction for a navy / warm-white / emerald palette: accent ratios, neutrals, and semantic colors that do not clash with an emerald brand accent

### Takeaway
Use a mostly neutral system: warm-white and white surfaces, navy ink, emerald below about 10% of any screen. The 60-30-10 heuristic supports this split, and separating brand tokens from functional or semantic tokens is the recommended way to stop a brand green being misread as "success". The contrast values below were computed (WCAG 2.x formula) for the proposed hexes.

### Cited Findings
- The 60-30-10 rule (dominant / secondary / accent) is a widely taught heuristic for balanced UI color. — [LogRocket](https://blog.logrocket.com/ux-design/60-30-10-rule/); [Groto SaaS guide](https://www.letsgroto.com/blog/60-30-10-rule)
- Treat the accent as a functional color (CTAs, active states, alerts). Separate brand colors from functional colors. Define semantic tokens (surface, interactive, and so on) with light and dark values instead of hard-coding hex values. Most SaaS products pair one primary accent with functional red (error) and green (success). — [Groto](https://www.letsgroto.com/blog/60-30-10-rule)
- Example of a brand green in the secondary or accent role (text, buttons, interactive elements): Hipcamp. — [WP Mayor](https://wpmayor.com/the-60-30-10-rule-made-our-website-designs-infinitely-better/)
- Step indicators need at least 4.5:1 contrast. Do not convey status by color alone; pair it with an icon or text. — [Toyota CDS](https://dx-playbook-prev.toyota-europe.com/cds/components/forms/stepper-pages/accessibility/); [UX4G](https://ux4g.gov.in/components/stepper)

### Inferences
**Original palette proposal.** Hexes are my own. Contrast ratios were computed locally with the WCAG relative-luminance formula against the canvas #FAF8F4 and against white #FFFFFF:

| Token | Hex | Role | Contrast on canvas / white |
|---|---|---|---|
| canvas | #FAF8F4 | Page background (warm white) | — |
| surface | #FFFFFF | Widget, quote and timeline surfaces | — |
| surface-subtle | #F3F0EA | Input wells, table zebra, hover | — |
| border | #DDD7CC | Hairlines and dividers (decorative only) | 1.35 / 1.43 (not for meaningful UI) |
| border-strong | #8E8A80 | Input borders and focusable outlines | 3.25 / 3.44 (meets the 3:1 non-text minimum) |
| ink-900 (navy) | #0F1E36 | Headings, figures, primary text, primary button fill | 15.72 / 16.68 |
| ink-700 | #3A4660 | Body and secondary text | 8.90 / 9.44 |
| ink-500 | #5F6878 | Labels and captions | 5.30 / 5.62 (AA body text) |
| ink-400 | #7A8291 | Placeholders and disabled text only | 3.65 / 3.87 (large text or non-essential only) |
| emerald-700 | #0B6B4C | Links, focus ring, selected state, accent text | 6.15 / 6.52; white text on it 6.52 |
| emerald-600 | #0E7C58 | Hover/active emerald, icons | 4.90 / 5.19 |
| emerald-500 | #12936A | Large decorative marks or illustration only | 3.66 / 3.88 (not for small text) |
| emerald-tint | #E8F3EE | Selected-row and completed-step backgrounds | emerald-700 text on it 5.74 |
| warning | #8A5300 on #FBF1DC | Expiring quote, network caution | 5.64 |
| error | #B42318 on #FDEDEB | Failed or reversed, validation errors | 5.79 |
| info | #2B4C8C on #EAF0FA | Processing or pending states, neutral notices | 7.29 |

Accent usage ratios (guidance, not measured from sources):
- **About 70 to 80% neutrals.** Canvas and surface whites, warm grays.
- **About 15 to 25% navy.** Text, figures, the primary button, header and footer.
- **Emerald at or below 5 to 10% of the visible area.** Links, the focus ring, the selected chip or radio, completed-step checks, the "You receive" emphasis underline or icon, and at most one emerald element per viewport that is not a text link.
- Do **not** use emerald for large backgrounds, gradients or hero washes.

The primary CTA should be **navy-filled with white text** (16.68:1). Emerald then stays an accent rather than a button color. This is the main lever against "brand green = success green" confusion. Alternative: emerald-700 CTAs with white text (6.52:1) are AA-compliant, but then success must be distinguished by icon and label.

**Success semantics.** Let "completed / confirmed" use the emerald family, since completion is on-brand and positive. Always pair it with a check icon and text ("Payout sent"). Do not use emerald for any non-success meaning, such as "warning resolved" or promotional badges.

**Pending / processing semantics.** Use the info blue-navy, not amber and not red. This follows the "pending is not failed" guidance in Q2.

**Warning.** Use ochre or amber text on a pale amber background (#8A5300 / #FBF1DC). Avoid yellow-greens, which would sit next to the emerald and look muddy.

**Error.** Use brick red (#B42318), a warm red that sits comfortably with both navy and emerald and avoids neon or pink reds. Use it only for terminal failures and validation errors, and always with a next action.

**Red/green accessibility.** Emerald success and red error can be confused by users with color-vision deficiency. Never rely on hue alone: use icons (check, alert triangle, x-circle), text labels and position.

**Charts or deltas.** If any are needed at all, avoid the green-up / red-down trading convention, which reintroduces the "trading terminal" feel. Prefer navy figures with signed text ("+$12.40").

**Dark mode** (if ever needed): keep it secondary. Swap the canvas to deep navy (about #0B1526) and lift emerald for contrast. Do not make dark the default, given Q1.

### Gaps
- I found no source that directly addresses resolving a brand-green accent against a success-green semantic color. The guidance above is inference built on the Groto brand-vs-functional token principle.
- I found no source giving measured accent-area percentages for credible fintech sites. The 5 to 10% emerald figure is a design recommendation derived from the 60-30-10 heuristic, not a measured norm.
- The contrast ratios were computed for proposed hexes and have not been checked against rendered output (anti-aliasing, font weight). Re-verify in the browser with an accessibility checker.
