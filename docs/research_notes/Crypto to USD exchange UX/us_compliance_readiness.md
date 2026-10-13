# US Regulatory and Operational Readiness for a Crypto-to-USD Exchange (Retail, Large-Ticket/OTC, Optional Courier Cash Delivery) and Implications for Website Disclosures/UX

> **NOT LEGAL ADVICE.** These are research notes compiled 2026-10-13 to inform a compliance-readiness document and the UI copy of a MOCK (non-production) website. Every item must be verified by qualified US counsel and compliance professionals before any real-money launch. Nothing here implies the project holds any registration, license, insurance, or bank relationship.
>
> **Method caveat:** During this research session, direct page fetches to primary sources (fincen.gov, ofac.treasury.gov, dfpi.ca.gov, dfs.ny.gov, ftc.gov, ecfr.gov, federalregister.gov, csbs.org) were blocked by the network proxy (HTTP 403 on CONNECT). Findings below come from web-search result extracts of those pages and of law-firm/trade-press summaries. Primary-source URLs are listed where the search surfaced them, but the full text was not read. Treat every figure as "verify against primary text."

## 1. FinCEN: MSB registration, BSA/AML program, CTR/SAR, recordkeeping/travel rule, customer identification, and how courier cash payouts change risk

### Takeaway
A business that exchanges convertible virtual currency (CVC) for USD is a "money transmitter" under the BSA. It must register with FinCEN as an MSB (registration is not a license), run a written AML program, file CTRs for more than $10,000 in cash (aggregated per person per business day) and SARs, and keep $3,000+ transmittal records/travel-rule data. Paying out in physical cash, especially by courier, moves the business into the highest-risk BSA category: CTR aggregation, structuring detection, and laundering of illicit crypto proceeds into untraceable cash. The newest FinCEN kiosk notice (Aug 2025) and the Southwest Border GTOs (2025-2027) show that regulators are watching exactly this pattern.

### Cited Findings
- **FIN-2019-G001** ("Application of FinCEN's Regulations to Certain Business Models Involving Convertible Virtual Currencies") was published **May 9, 2019**. It applies the BSA and FinCEN regulations to money transmission involving CVC. Primary PDF: [FinCEN CVC Guidance (fincen.gov)](https://www.fincen.gov/system/files/2019-05/FinCEN%20CVC%20Guidance%20FINAL.pdf); summary: [Sullivan & Cromwell memo](https://www.sullcrom.com/SullivanCromwell/_Assets/PDFs/Memos/SC-Publication-FinCEN-Issues-Updated-Convertible-Virtual-Currency-Guidance.pdf); [Money Laundering News, May 2019](https://www.moneylaunderingnews.com/2019/05/new-fincen-cryptocurrency-guidance-provides-comprehensive-overview-of-bsa-application-to-crypto-businesses/)
- Under the guidance, hosted-wallet providers are money transmitters. A person using an unhosted wallet to buy goods or services for their own account is not. The guidance also addresses CVC kiosks — [FinCEN CVC Guidance PDF](https://www.fincen.gov/system/files/2019-05/FinCEN%20CVC%20Guidance%20FINAL.pdf) (via search extract)
- Basis for exchanger status: FinCEN's **2013** guidance treats any virtual currency "exchanger" as a money transmitter that must **register as an MSB within 180 days of beginning operations** — [Hunton, FinCEN first P2P enforcement action](https://hunton.com/blockchain-legal-resource/fincen-announces-first-enforcement-action-against-peer-to-peer-virtual-currency-exchange)
- FinCEN registration (31 U.S.C. 5330) is a compliance registration, **not a license to operate**, and does not replace state licenses — [Ridgeway, MTL guide](https://www.ridgewayfs.com/money-transmitter-license-guide/); [Dechert, "Patchwork Quilt" (2019)](https://www.dechert.com/content/dam/dechert%20files/knowledge/publication/2019/7/USRegulatoryPatchworkQuiltCryptocurrencyAndMoneyTransmitterLicensing.pdf)
- Operating an unlicensed money transmitting business is a federal crime under **18 U.S.C. 1960** (up to 5 years' imprisonment, fines cited at up to $250,000) — [Ridgeway, MTL guide](https://www.ridgewayfs.com/money-transmitter-license-guide/)
- **Travel rule / recordkeeping:** CVC transmittal orders can fall within the Funds Travel Rule. The threshold is **$3,000** under **31 CFR 1010.410(f)** (the threshold comes from the general regulation; FIN-2019-G001 applies it to CVC) — [FinCEN CVC Guidance PDF](https://www.fincen.gov/system/files/2019-05/FinCEN%20CVC%20Guidance%20FINAL.pdf); [terms.law travel-rule guide (secondary)](https://terms.law/Trading-Legal/guides/travel-rule-crypto.html)
- Practitioner reading: for transfers to or from an **unhosted wallet**, the VASP still collects its own customer's information, but nothing can be "transmitted" to the wallet. This is a practitioner interpretation, not guidance text — [terms.law (secondary)](https://terms.law/Trading-Legal/guides/travel-rule-crypto.html)
- **Unhosted-wallet NPRM (Dec 23, 2020)** — "Requirements for Certain Transactions Involving Convertible Virtual Currency or Digital Assets." It proposed CTR-like reporting of CVC transactions over $10,000, aggregated per 24 hours (not aggregated with fiat). **No evidence found that it was finalized** — [Federal Register 2020-28437](https://www.federalregister.gov/documents/2020/12/23/2020-28437/requirements-for-certain-transactions-involving-convertible-virtual-currency-or-digital-assets); [Skadden summary (Jan 2021)](https://www.skadden.com/-/media/Files/Publications/2021/01/FinCENProposesNewReportingRecordkeepingandVerifica.pdf?sc_lang=en)
- **CTR aggregation:** For MSBs, 31 CFR 1022.313 cross-refers to **1010.313**. Multiple currency transactions are treated as one when the institution knows they are by or on behalf of the same person and total **more than $10,000 cash-in or cash-out in one business day** — [eCFR Part 1022 Subpart C](https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1022/subpart-C); [GPO CFR 1010.312/313](https://www.gpo.gov/fdsys/pkg/CFR-2014-title31-vol3/pdf/CFR-2014-title31-vol3-sec1010-312.pdf)
- **Structuring (31 CFR 1010.314)** is itself unlawful. Splitting cash across days, each amount under $10,000, can be structuring even where CTR aggregation does not apply — [FinCEN Ruling 2005-6](https://www.fincen.gov/sites/default/files/administrative_ruling/fincenruling2005-6.pdf) (via search extract)
- FinCEN has held that an MSB must aggregate currency transactions **across multiple agents** for CTR purposes (2002 ruling to Western Union). This is relevant if multiple couriers or agents hand out cash — [FinCEN Western Union assessment](https://www.fincen.gov/sites/default/files/enforcement_action/western_union_assessment.pdf) (via search extract)
- **Precedent (cash, in-person P2P exchanger):** In **April 2019**, FinCEN's first enforcement action against a P2P CVC exchanger (Eric Powers) found failure to register, no AML program, no written BSA policies, and **no CTRs on 200+ transactions involving more than $10,000 in cash**. Penalty about $35,000 ($35,350 per Clifford Chance), plus an industry bar. Transaction counts differ between sources — [Clifford Chance, Apr 2019](https://www.cliffordchance.com/insights/resources/blogs/regulatory-investigations-financial-crime-insights/2019/04/us-department-of-treasurys-fincen-penalizes-individual-operating-peer-to-peer.html); [Hunton](https://hunton.com/blockchain-legal-resource/fincen-announces-first-enforcement-action-against-peer-to-peer-virtual-currency-exchange); [McDermott (reports 1,700+ transactions)](https://www.mcdermottlaw.com/?p=341661); [The Block](https://www.theblock.co/linked/20207/fincen-penalizes-peer-to-peer-bitcoin-trader-for-the-first-time)
- A related criminal case for unlicensed bitcoin-for-cash exchange (Jacob Burrell Campos) resulted in a 2-year prison sentence — [Bitcoin Magazine](https://bitcoinmagazine.com/business/fincen-issues-first-ever-civil-penalty-against-bitcoin-exchange)
- **FinCEN Notice FIN-2025-NTC1 (Aug 4, 2025), CVC kiosks.** It urges vigilance and SAR reporting on CVC kiosks. It cites FBI IC3 data: **10,956 kiosk complaints and about $246.7M in losses in 2024** (about +99% complaints and +31% losses versus 2023). It also cites kiosk use to launder suspected drug proceeds, lists red flags (many concern transactions just under reporting thresholds or kiosk limits), and asks for the SAR keyword **"FIN-2025-CVCKIOSK"**. Secondary sources disagree on the notice number (NTC1 vs NTC11); the fincen.gov PDF filename is "FinCEN-Notice-CVCKIOSK" — [FinCEN Notice PDF](https://www.fincen.gov/sites/default/files/shared/FinCEN-Notice-CVCKIOSK.pdf); [FinCEN press release](https://www.fincen.gov/news/news-releases/fincen-issues-notice-use-convertible-virtual-currency-kiosks-scam-payments-and); [Money Laundering News, Aug 2025](https://www.moneylaunderingnews.com/2025/08/fincens-focus-on-cryptocurrency-kiosks-and-financial-crime/); [Burgher Gray](https://burghergray.com/fincen-raises-red-flags-on-cvc-kiosks-what-financial-institutions-need-to-know-now/)
- **Southwest Border Geographic Targeting Orders (cash at MSBs):**
  - **March 2025:** the original GTO lowered the CTR threshold for MSB cash transactions to **$200** in 30 ZIP codes in TX and CA. A federal court issued a TRO in **April 2025**, and on **July 13, 2026** the Ninth Circuit affirmed the preliminary injunction.
  - Later GTOs used a **$1,000** threshold: Arizona was added after Sept 2025, and New Mexico in March 2026.
  - The **Sept 2, 2026** reissuance dropped the CA and AZ counties and runs to **March 1, 2027**.
  - An Arizona MSB sued over the March 2026 order on **April 7, 2026**; the outcome is unknown.
  - Sources: [MoFo, Sept 2026](https://www.mofo.com/resources/insights/260911-fincen-reissues-geographic-targeting-order); [Orrick InfoBytes, Jul 17 2026](https://infobytes.orrick.com/2026-07-17/ninth-circuit-affirms-preliminary-injunction-of-fincens-reporting-order-for-businesses-along-the-southern-border/); [Orrick InfoBytes, Apr 16 2026](https://infobytes.orrick.com/2026-04-16/money-services-business-challenges-fincens-southwest-border-reporting-order/); [ABA Banking Journal, Apr 2025](https://bankingjournal.aba.com/2025/04/court-orders-pause-for-southwest-border-geographic-targeting-order/)
- **AML program rule in flux:** FinCEN published a new **AML/CFT Program NPRM on April 10, 2026** (comments due June 9, 2026). It replaces/withdraws the 2024 proposal and moves toward an "effective," risk-based program standard. **No final rule or effective date was found as of Aug-Oct 2026** — [Federal Register 2026-07033](https://www.federalregister.gov/documents/2026/04/10/2026-07033/anti-money-laundering-and-countering-the-financing-of-terrorism-programs); [FinCEN Program NPRM PDF](https://www.fincen.gov/system/files/2026-04/Program-NPRM.pdf); [WBK summary](https://www.thewbkfirm.com/industry/fincen-proposed-rule-aims-to-reform-requirements-for-aml-cft-programs)

### Inferences
- A cash-paying crypto off-ramp, especially one that hands cash to a person at a home or other location, is the classic pattern for converting illicit crypto (scam, ransomware, or drug proceeds) into untraceable USD. Expect bank partners, state examiners, and FinCEN to rate a courier-cash product as highest risk. In practice it will need:
  - per-person aggregation across channels, couriers, and days;
  - structuring analytics (repeated payouts just under $10,000, the $3,000 recordkeeping threshold, or any GTO threshold);
  - documented ID verification at handoff, with CTR data captured before the cash is released;
  - geography checks against active GTO ZIP codes (thresholds as low as $1,000).
- The Powers precedent shows that "in-person cash + crypto" without registration, AML, and CTRs is an enforcement-ready fact pattern, even at small scale.
- Because the AML program rule is mid-rulemaking (2026 NPRM), the readiness doc should be built to the current 31 CFR 1022.210 program requirements and also track the final rule.
- UX implication: the mock site must show that ID and KYC are required *before* quoting cash delivery. It should state that cash payouts above reporting thresholds are reported to the government, and that splitting transactions to avoid reporting is illegal. Copy should be framed as "a licensed operator would be required to…", never as present-tense compliance claims.

### Gaps
- The full text of FIN-2019-G001 and the FIN-2025-NTC1 red-flag list could not be read directly (fetch blocked). Verify section references and the list of 15 red flags.
- **SAR threshold for MSBs:** I believe it is $2,000 (31 CFR 1022.320). Also unverified this session: the CTR filing deadline (15 days), MSB registration renewal every 2 years, and the 2020 proposal to lower the international travel-rule threshold to $250. None of these was confirmed in a source this session. Verify on eCFR and FinCEN.
- Whether the Dec 2020 unhosted-wallet NPRM was ever finalized or formally withdrawn was not confirmed.
- There is no MSB-specific "CIP rule" equivalent to the bank CIP. The exact customer-identification obligations for MSBs (AML-program-based verification; 31 CFR 1010.312 ID verification for CTRs) need confirmation from primary text.
- No source was found on how FinCEN treats a third-party courier delivering cash, i.e. whether the courier is an agent of the MSB with its own obligations. Counsel should address this.

## 2. State money transmitter licensing: NMLS and MTMA, NY BitLicense, California DFAL (timeline, kiosk and disclosure provisions), other notable states

### Takeaway
State licensing is the main gating item. It is a 50-state patchwork, increasingly harmonized by the CSBS Money Transmission Modernization Act (MTMA): about 35 states had enacted it in full or in part by Aug 2026. New York requires a BitLicense (23 NYCRR Part 200), in force since 2015 with prescriptive risk-disclosure rules. California's DFAL licensing requirement became operative **July 1, 2026**, with applications through NMLS since March 9, 2026. Last-minute amendments came via **SB 97** (signed June 30, 2026). A wave of 2025-2026 state crypto-kiosk statutes sets daily caps, fee caps, refund rights, and disclosures that are a useful benchmark for cash-adjacent retail products.

### Cited Findings
- **MTMA adoption:**
  - CSBS (via a law-firm summary): **35 states** had enacted the MTMA in full or part as of **August 2026**. Licensees operating in at least one MTMA state account for about 99% of reported money transmission activity.
  - Earlier CSBS page: 31 states as of January 2026.
  - On **Sept 3, 2026**, CSBS launched a formal process for industry to request MTMA implementation guidance.
  - Sources: [Business Law Today (Sept 2026)](https://businesslawtoday.org/?p=36626); [CSBS MTMA page](https://www.csbs.org/node/231461); [Stinson, Massachusetts adoption](https://www.stinson.com/newsroom-publications-massachusetts-adopts-the-model-money-transmission-modernization-act-joining-25-other-states)
- Counts conflict. Vixio (July 2026) reports 13 full adoptions (only 3 with the virtual-currency provisions), 9 partial, and 8 pending. That is a different counting method — [Vixio](https://www.vixio.com/articles/money-transmission-modernization-act-adoption-across-us-states). Louisiana (H.B. 1230) and Oklahoma (H.B. 3521) are reported as 2026 enactments (secondary) — [private.law wiki](https://wiki.private.law/en/money-transmitter-license-usa); [Louisiana OFI 2026 LMTA legislation](https://ofi.la.gov/wp-content/uploads/2026/06/NonDep_2026_LMTA_LegislationFinal.pdf)
- **State treatment of crypto varies.**
  - Ohio: buying and selling crypto as a business generally requires a money transmitter license.
  - Florida: a 2018 declaratory statement said a license was not required for a Bitcoin ATM. Florida's law has since evolved.
  - Pennsylvania: has exempted most crypto businesses by guidance.
  - Sources: [Ohio Dept. of Commerce](https://com.ohio.gov/wps/portal/gov/com/divisions-and-programs/financial-institutions/money-transmitters/guides-and-resources/money-transmitter-resources); [Hodder Law (Florida)](https://hodder.law/florida-bitcoin-regulation-evolution/); [Dechert (2019)](https://www.dechert.com/content/dam/dechert%20files/knowledge/publication/2019/7/USRegulatoryPatchworkQuiltCryptocurrencyAndMoneyTransmitterLicensing.pdf)
- **New York BitLicense (23 NYCRR Part 200):**
  - Effective **June 24, 2015** and still in force as of June 2026 — [CryptoSlate law profile](https://cryptoslate.com/crypto-laws/bitlicense-23-nycrr-part-200/)
  - **§ 200.19(a)** requires clear, conspicuous, legible written disclosure, before the initial transaction, of all material risks, in English and any other predominant customer language. One required risk: virtual currency "is not legal tender, is not backed by the government, and accounts and value balances are not subject to [FDIC] or [SIPC] protections" — [Justia, 23 NYCRR 200.19](https://regulations.justia.com/states/new-york/title-23/chapter-i/part-200/section-200-19)
  - The 2014 proposal also required per-transaction receipts covering: contact info including a complaints line, transaction type, value, date/time, fee, exchange rate, liability for non-delivery/delay, and refund policy. The final text was not verified — [Network World (2014)](https://www.networkworld.com/article/2455602/software/new-yorks-proposed-bitcoin-rules-include-consumer-protections.html)
- **NYDFS blockchain analytics:** the April 2022 guidance told BitLicensees to use blockchain analytics for CDD, transaction monitoring, and sanctions screening. On **Sept 17, 2025** this was extended to NY banking organizations. It is a supervisory expectation, not a rule — [The Block](https://www.theblock.co/post/371083/ny-financial-regulator-urges-banks-to-adopt-blockchain-analytics-to-combat-illicit-activity); [Mondaq/Sheppard Mullin](https://mondaq.com/unitedstates/fin-tech/1684106/nydfs-directs-banks-to-incorporate-blockchain-analytics-into-virtual-currency-risk-programs)
- **California DFAL — licensing timeline:**
  - DFPI began accepting license applications via **NMLS on March 9, 2026**.
  - A complete application by **July 1, 2026** was required to keep serving California residents under the transitional (pending-application) path.
  - Sources: [DFPI DFAL page](https://dfpi.ca.gov/financial-services/digital-financial-assets-law/); [DFPI DFAL FAQ](https://dfpi.ca.gov/dfal/faq/); [Goodwin, Apr 2026](https://www.goodwinlaw.com/en/insights/publications/2026/04/alerts-finance-dcb-california-dfal-license-application-open); [Bloomberg Law](https://news.bloomberglaw.com/cannabis/californias-digital-asset-license-deadline-threatens-disruption-2)
- **California SB 97 (signed June 30, 2026, urgency statute, reported as Stats. 2026, Ch. 52):**
  - repealed DFAL Chapter 6 (stablecoins), deferring to the federal GENIUS Act framework;
  - excluded affinity/rewards values and in-game publisher tokens; removed in-game exchanges from scope;
  - required a "completed application" for pending-application status;
  - narrowed reporting to "material" breaches.
  - One compliance site describes the stablecoin changes differently; the law-firm accounts are better supported.
  - Sources: [Orrick InfoBytes, Jul 17 2026](https://infobytes.orrick.com/2026-07-17/california-enacts-amendments-to-digital-financial-assets-law-as-licensing-requirements-take-effect-july-1/); [MoFo, Jul 2026](https://www.mofo.com/resources/insights/260729-california-digital-assets-and-fintech-update); [CalMatters Digital Democracy SB 97](https://calmatters.digitaldemocracy.org/bills/ca_202520260sb97)
- **DFAL kiosk provisions (SB 401):**
  - Location reporting, the **$1,000 per-customer daily limit**, and receipt requirements have applied since **Jan 1, 2024**.
  - Charge caps and pre-transaction written disclosures have applied since **Jan 1, 2025**.
  - Kiosk licensing applies from **July 1, 2026**. Other SB 401 dates were unchanged by AB 1934.
  - Charge cap reported as the greater of **$5 or 15%** (secondary, unverified against statute).
  - Sources: [DFPI FAQ](https://dfpi.ca.gov/dfal/faq/); [CryptoSlate DFAL kiosk profile](https://cryptoslate.com/crypto-laws/california-dfal-crypto-kiosk-provisions/); [kioskindustry.org](https://kioskindustry.org/psa-crypto-bitcoin-atm-kiosks-california-mandatory-dfpi-filing/)
- In **Sept 2024**, LA Superior Court upheld the $1,000 daily kiosk cap as a reasonable anti-fraud measure — [DFPI ruling PDF](https://dfpi.ca.gov/wp-content/uploads/sites/337/2024/09/24-09-04-Crypto-Kiosk-Ruling.pdf); [DFPI Sept 2024 bulletin](https://dfpi.ca.gov/news/monthly-bulletins/september-2024-monthly-bulletin/)
- **First DFAL enforcement (June 2025):** Coinme consent order, a $300,000 penalty and $51,700 restitution, for exceeding the $1,000 daily limit and omitting required receipt disclosures — [DFPI press release](https://dfpi.ca.gov/press_release/dfpi-fines-coinme-300000-related-to-crypto-kiosk-violations-secures-51700-in-restitution-for-victims/); [Orrick InfoBytes, Jul 2025](https://infobytes.orrick.com/2025-07-03/dfpi-settles-with-crypto-kiosk-operator-for-350k/)
- **Other state kiosk statutes 2025-2026 (mostly secondary summaries):**
  - **Illinois**, eff. Aug 18, 2025: $2,500/day new customers, $10,500 existing; refunds.
  - **Nebraska**, in force Sept 3, 2025: $2,000 new / $10,500 existing; LB717 amendments eff. July 18, 2026.
  - **Maine**, eff. June 12, 2025: $1,000/day; fee cap greater of $5 or 3%.
  - **Connecticut**: fee cap 15%; $2,000 new / $5,000 existing; 72-hour fraud refunds for new customers; enforcement action March 2026.
  - **Kentucky** SB 189, enacted Apr 13, 2026.
  - **Alabama** HB303, enacted Apr 8, 2026, eff. Oct 1, 2026: $1,000/day and $10,000/month for new consumers; refunds.
  - **North Carolina** H920 (SL 2026-45).
  - Pending: NH, MS, PA.
  - Sources: [PYMNTS/CPI](https://www.pymnts.com/cpi-posts/states-move-to-rein-in-crypto-kiosks-as-fraud-concerns-mount/); [CryptoSlate CT](https://cryptoslate.com/crypto-laws/connecticut-digital-currency-kiosk-consumer-protection-regime/); [CryptoSlate IL](https://cryptoslate.com/crypto-laws/illinois-digital-asset-kiosks-act-virtual-currency-kiosk-consumer-protection/); [CryptoSlate ME](https://cryptoslate.com/crypto-laws/maine-virtual-currency-kiosk-act/); [CryptoSlate NE](https://cryptoslate.com/crypto-laws/nebraska-controllable-electronic-record-fraud-prevention-act/); [CryptoSlate AL](https://cryptoslate.com/crypto-laws/alabama-cryptocurrency-kiosk-fraud-prevention-act-united-states/); [Orrick, Kentucky](https://infobytes.orrick.com/2026-04-24/kentucky-enacts-virtual-currency-kiosk-operator-framework/); [NCGA H920](https://ncleg.gov/Legislation/SummariesPublication/Summary/2024/11/H920-SMRQ-99(sl)-v-4/)

### Inferences
- A real launch needs a state-by-state licensing matrix before serving any state's residents. Minimum items:
  - an NY BitLicense (or a NY limited-purpose trust charter / partner) for NY;
  - DFAL licensure or pending status for CA (the July 1, 2026 transitional window has closed, so a new entrant likely cannot operate in CA until licensed — verify);
  - MTMA-based MTLs elsewhere, with Pennsylvania, Florida, and Ohio analyzed individually.
- The mock site should either geo-scope its demo copy ("This prototype is not available to residents of any state; no licenses are held") or show a placeholder "Licensing & Disclosures" page with *empty, clearly-marked* fields such as "[NMLS ID — none; not licensed]". It must never show a fabricated NMLS number.
- The kiosk statutes are not directly applicable to a website or courier service, but regulators may view a cash-delivery off-ramp through the same elder-fraud lens. Their features are reasonable UX defaults:
  - lower limits for new customers;
  - cooling-off or hold periods;
  - fee caps and spread disclosure;
  - fraud warnings and refund windows.
- Caveat for the kiosk analogy: those laws regulate *cash-in → crypto* scams, while this product is *crypto → cash-out*.

### Gaps
- The DFPI DFAL FAQ and statute text (Fin. Code § 3101 et seq.; the kiosk chapter) could not be read directly. The exact DFAL general consumer-disclosure sections (fee schedules, irreversibility, receipts for non-kiosk licensees) and DFPI's finalized DFAL regulations (MoFo references "Finalized DFAL Rulemaking", Jul 2026) are unverified.
- Whether a new applicant after July 1, 2026 may operate in CA while its application is pending is unconfirmed (believed not).
- The current NY BitLicense receipt/disclosure text (§ 200.19(b)-(g)) and any 2025-2026 DFS amendments were not verified.
- Exact MTMA adoption by state, and which states adopted the MTMA virtual-currency article, needs to be checked on the live CSBS tracker.

## 3. OFAC sanctions screening for customers and blockchain addresses; blockchain analytics expectations

### Takeaway
OFAC liability is strict. OFAC's **Oct 15, 2021** virtual-currency guidance expects firms to screen customers, counterparties, IP/geolocation data, and wallet addresses against the SDN List, which has included crypto addresses since 2018. Firms should also use risk-based blockchain analytics (no specific tool mandated) to catch indirect exposure and to run lookbacks when new addresses are designated. NYDFS has made blockchain analytics an explicit supervisory expectation.

### Cited Findings
- OFAC "Sanctions Compliance Guidance for the Virtual Currency Industry," **Oct 15, 2021**. OFAC has listed virtual currency addresses in SDN entries since **2018** and expects firms to be able to identify and block transactions tied to them — [Davis Polk](https://www.davispolk.com/insights/client-update/ofac-publishes-sanctions-compliance-guidance-virtual-currency-industry); [Perkins Coie](https://perkinscoie.com/insights/update/ofac-releases-new-detailed-guidance-digital-currency-industry)
- Listed addresses can be used to identify related, unlisted addresses (for example, ones sharing a wallet with a listed address) — [Capco](https://www.capco.com/intelligence/capco-intelligence/ofac-sanctions-guidance-for-virtual-currency-companies)
- OFAC recognizes the value of blockchain analytics but **does not mandate particular software** — [Davis Polk](https://www.davispolk.com/insights/client-update/ofac-publishes-sanctions-compliance-guidance-virtual-currency-industry)
- Firms should screen customers, counterparties, and transaction data, and use data collected for other purposes, **such as IP addresses**. Enforcement cases involved unscreened IP-based sanctions exposure — [Guidehouse](https://guidehouse.com/insights/financial-crimes/2021/ofac-sanctions-compliance-virtual-currency); [Davis Polk](https://www.davispolk.com/insights/client-update/ofac-publishes-sanctions-compliance-guidance-virtual-currency-industry)
- Firms may perform **historical lookbacks** after new address designations — [Weil](https://weil.com/-/media/files/pdfs/2021/ofac-issues-sanctions-compliance-guidelines-for-virtual-currency-industry.pdf)
- OFAC civil penalties apply on a **strict liability** basis — [Guidehouse](https://guidehouse.com/insights/financial-crimes/2021/ofac-sanctions-compliance-virtual-currency)
- NYDFS expects analytics for wallet screening, fund-origin verification, and monitoring exposure to high-risk VASPs (2022; extended Sept 17, 2025) — [The Block](https://www.theblock.co/post/371083/ny-financial-regulator-urges-banks-to-adopt-blockchain-analytics-to-combat-illicit-activity); [Elliptic blog](https://www.elliptic.co/blog/new-york-banks-get-clarity-on-blockchain-analytics-requirements-for-digital-assets)

### Inferences
- Readiness checklist items:
  - SDN/consolidated-list name screening at onboarding and on list updates;
  - wallet-address screening for every deposit address and source of funds (direct and indirect exposure scoring);
  - IP and geolocation blocking of comprehensively sanctioned jurisdictions;
  - a documented lookback procedure;
  - a blocked/rejected-transaction reporting procedure.
- UX implication: the deposit flow should disclose that incoming crypto is screened. If funds are flagged, they may be held, rejected, or blocked and reported, and payout may be delayed or refused. A prospective crypto-to-USD site must not promise that "all deposits will be paid out."

### Gaps
- The OFAC guidance text on ofac.treasury.gov could not be read directly. OFAC's 10-day blocked-property reporting and annual reporting requirements are unverified here.
- No 2025-2026 OFAC update to the 2021 virtual-currency guidance was found. That does not mean none exists.

## 4. Consumer disclosures: fees/exchange rate before transaction, receipts, error resolution, risk warnings, irreversibility, scam/elder-fraud warnings

### Takeaway
The clearest US templates for crypto consumer disclosures are NY's § 200.19 and California's DFAL kiosk provisions (pre-transaction disclosures and charge caps since Jan 1, 2025; receipts since Jan 1, 2024), plus the 2025-2026 state kiosk statutes:
- pre-transaction fee, spread, and exchange-rate disclosure;
- a "not legal tender / not FDIC or SIPC insured" warning;
- receipts with fee, rate, and complaint contacts;
- irreversibility and scam warnings, plus refund windows for new customers.

Federal data from the FTC and FinCEN show crypto-related scams disproportionately hit people over 60, so prominent scam interstitials are expected practice.

### Cited Findings
- NY § 200.19(a): written, conspicuous risk disclosure before the initial transaction (not legal tender; not FDIC/SIPC protected; other material risks), in English and any predominant customer language — [Justia 23 NYCRR 200.19](https://regulations.justia.com/states/new-york/title-23/chapter-i/part-200/section-200-19)
- NY 2014 proposed receipt contents: operator contact and complaint line, transaction type, value, date/time, fee, exchange rate, liability for non-delivery/delay, refund policy (proposal; final text not verified) — [Network World, 2014](https://www.networkworld.com/article/2455602/software/new-yorks-proposed-bitcoin-rules-include-consumer-protections.html)
- CA DFAL kiosks: written disclosures **before** the transaction and charge limits from **Jan 1, 2025**; receipts from **Jan 1, 2024**. Coinme was penalized for receipt omissions, including the spread between market price and quoted price — [DFPI Coinme press release](https://dfpi.ca.gov/press_release/dfpi-fines-coinme-300000-related-to-crypto-kiosk-violations-secures-51700-in-restitution-for-victims/); [Regulatory Oversight blog, Jul 2025](https://www.regulatoryoversight.com/2025/07/californias-dfpi-brings-first-enforcement-action-under-californias-digital-financial-assets-law/)
- Common themes of state kiosk laws: daily caps (higher for existing customers), fraud refund rights (often new customers or short windows), fee caps, and pre-transaction and receipt disclosures of fees, exchange rates, and **irreversibility warnings** — [PYMNTS/CPI](https://www.pymnts.com/cpi-posts/states-move-to-rein-in-crypto-kiosks-as-fraud-concerns-mount/)
- **FTC Data Spotlight / press release (Sept 2024):**
  - Bitcoin ATM scam losses rose nearly **tenfold from 2020 to 2023, to more than $110M**, and topped **$65M in H1 2024**.
  - People **60+ were more than 3x as likely** as younger adults to report a loss. Median loss in H1 2024 was **$10,000**.
  - Common scripts: government, business, and tech-support impersonation, where victims are told to move cash to "protect" it.
  - Sources: [FTC press release, Sept 2024](https://ftc.gov/news-events/news/press-releases/2024/09/new-ftc-data-shows-massive-increase-losses-bitcoin-atm-scams); [NH Banking Dept repost](https://banking.nh.gov/news-and-media/ftc-data-shows-massive-increase-losses-bitcoin-scams-older-adults-often-targeted)
- FinCEN (Aug 2025): FBI IC3 counted 10,956 kiosk complaints and about $246.7M in 2024 losses; scams targeting older adults are a focus — [FinCEN press release](https://www.fincen.gov/news/news-releases/fincen-issues-notice-use-convertible-virtual-currency-kiosks-scam-payments-and)

### Inferences
- Recommended disclosure set for the mock UI. Mark each with "[Mock — placeholder, not legally reviewed]".
  1. **Pre-trade quote screen:** crypto amount, reference market rate, the quoted rate, the **spread** shown as a $ amount and %, every fee itemized (network, service, courier), the total USD the customer receives, and how long the quote is valid.
  2. **Risk disclosure** before the first transaction: not legal tender; not FDIC/SIPC insured; price volatility; **blockchain transactions are irreversible** once sent; payout may be delayed or refused for compliance reasons.
  3. **Scam interstitial:** "No government agency, bank, or tech-support company will ever ask you to convert crypto to cash for them," with a prompt to stop if a stranger is directing the transaction. Link to FTC reporting (reportfraud.ftc.gov) and IC3 (ic3.gov) — verify URLs.
  4. **Receipt:** operator name and contact, complaint channel, transaction ID and tx hash, date/time, amounts, rate, fees, spread, and refund/error policy.
  5. **Error-resolution and complaints page** with the state-regulator complaint path (left blank in the mock).
- Regulation E error resolution is generally tied to "electronic fund transfers" from consumer accounts. Whether it applies to a given crypto-to-USD flow (e.g., the USD leg to a bank account) needs counsel analysis — see Gaps.

### Gaps
- Not verified this session:
  - whether CFPB Regulation E / the Remittance Transfer Rule applies to the USD payout leg;
  - the current status of any CFPB crypto-related interpretive rule;
  - the exact DFAL disclosure statute for non-kiosk licensees (believed to be Fin. Code § 3500-series) and its required wording.
- No FTC or FinCEN 2025-2026 notice specific to crypto *cash-out* scams was found. The kiosk data concerns cash-in.

## 5. Courier cash delivery: operational and legal issues and precedents

### Takeaway
No US precedent was found of a licensed crypto exchange offering doorstep USD cash delivery. The closest analogues are enforcement actions against in-person cash bitcoin traders (FinCEN/Powers 2019; DOJ/Campos), which is a cautionary rather than a positive precedent. Courier delivery stacks several regimes on top of the money-transmission ones: armored-car/cash-in-transit licensing and insurance (state-specific; NY, for example, requires $10M all-risk cover), physical-security risk (crypto "wrench attacks" hit a record in 2025), CTR/structuring controls at the point of handoff, and identity verification at the door.

### Cited Findings
- The Powers case (FinCEN, Apr 2019) involved transactions finalized in person, including 200+ cash transactions over $10,000 with no CTRs — [Clifford Chance](https://www.cliffordchance.com/insights/resources/blogs/regulatory-investigations-financial-crime-insights/2019/04/us-department-of-treasurys-fincen-penalizes-individual-operating-peer-to-peer.html)
- **New York armored car carriers** (Gen. Bus. Law § 89-iii) need a Dept. of State license, fingerprinting of principals, at least **$10M all-risk insurance** plus coverage for the value of cargo in transit or in vaults, and general liability of **$500K per occurrence / $1M aggregate**. Lapsed coverage is grounds for license refusal, suspension, or revocation — [NY DOS armored car license](https://dos.ny.gov/get-armored-car-carrier-license); [NY GBL § 89-iii](https://nysenate.gov/legislation/laws/GBS/89-III)
- **Utah** armored car companies must carry liability insurance covering general liability, assault and battery, personal injury, property in custody, and E&O, with at least **$500K per incident / $2M aggregate** — [Utah Admin. Code R156-63b-302e](https://www.law.cornell.edu/regulations/utah/Utah-Admin-Code-R156-63b-302e)
- Other states (CA, TX, FL) regulate armored or private-security carriers through their own security licensing regimes (secondary, unverified) — [Armormax blog](https://armormax.com/blog/best-armored-trucks-for-cash-transport-business-2026/)
- **Physical-security risk:** CertiK counted **72 verified "wrench attacks" worldwide in 2025** (up from 41 in 2024), with kidnapping the most common tactic (25 cases) and confirmed losses of more than $40.9M. CertiK is a vendor source; Europe accounts for about 40% of incidents — [Decrypt, citing CertiK](https://decrypt.co/356604/41m-in-losses-as-crypto-wrench-attacks-hit-record-high-in-2025); [CertiK report](https://www.certik.com/blog/skynet-wrench-attacks-report)
- Kiosks have been used to launder suspected drug proceeds, per BSA data cited by FinCEN — [FinCEN press release, Aug 2025](https://www.fincen.gov/news/news-releases/fincen-issues-notice-use-convertible-virtual-currency-kiosks-scam-payments-and)
- Under the Western Union ruling, CTR aggregation applies across multiple agents — [FinCEN Western Union assessment](https://www.fincen.gov/sites/default/files/enforcement_action/western_union_assessment.pdf)

### Inferences
- Operational readiness items for courier cash, if pursued at all:
  - **Partner model:** a licensed armored-carrier / cash-in-transit partner, under contract, with insurance certificates (all-risk/cargo, general liability, crime/fidelity).
  - **State law:** confirm whether residential delivery is permitted under each state's carrier license, and whether couriers are agents of the MSB (agent oversight under the AML program).
  - **Cash supply:** cash vaulting and supply from a bank willing to serve a crypto MSB with cash needs (a high de-risking hurdle).
  - **Handoff:** ID re-verification at the door matching the KYC record (no third-party recipients); signed or electronic receipt; photo/biometric match; geofenced delivery addresses verified in advance.
  - **Reporting:** CTR data captured *before* release, with aggregation across all channels per business day.
  - **Limits and staff safety:** per-delivery and per-day cash caps, randomized schedules, no cash amounts on courier devices, duress procedures.
  - **Scam check:** scam screening for elderly or coached customers before dispatch.
- Courier cash is likely the single largest de-risking issue for bank partners and the biggest examiner focus. It should be presented in the mock as **"Concept only — not offered."**
- UX implications:
  - the courier option should be visibly gated ("Requires full identity verification; availability subject to licensing, location and limits; not currently offered");
  - cash amounts should not be shown as instantly available;
  - the copy must never say "no ID," "anonymous," "discreet," or "no reporting" (classic structuring and illicit-finance red flags).

### Gaps
- No US precedent of a regulated crypto exchange offering residential cash delivery was found, and no regulator guidance specific to courier cash payouts by MSBs. Abroad there is anecdotal OTC "cash courier" activity (not researched or sourced here).
- Insurance market availability and cost for cash-in-transit to residential addresses is unknown.
- No source addressed robbery statistics specific to in-person crypto-for-cash trades in the US.
- Whether delivery staff must hold state security-guard or armed-guard licenses depends on the state. Not researched.

## 6. Large transactions / OTC: enhanced due diligence, source of funds, and access gating

### Takeaway
OTC desks gate access through risk-rated onboarding:
- EDD for high-risk clients: beneficial-ownership verification, independent corroboration of source of wealth and source of funds;
- pre-registration and analytics-screening of settlement wallets;
- trade-size caps until a history exists;
- high minimum ticket sizes, which are commercial choices rather than regulatory thresholds.

No regulator-issued OTC threshold was found. The BSA thresholds ($3,000 recordkeeping, $10,000 CTR for cash) still apply.

### Cited Findings
- OTC desks assign an initial risk rating that drives EDD, trade-size limits, and extra approvals. EDD for high-risk clients adds deeper beneficial-owner verification, independent corroboration of source of wealth, and tighter limits until behavior is validated — [Elliptic, OTC due diligence](https://www.elliptic.co/corpus/gen-2630/over-the-counter-finance/otc-desk-due-diligence-and-counterparty-risk-controls-for-digital-asset-trades.html); [Elliptic, KYC for OTC clients](https://www.elliptic.co/corpus/gen-2630/over-the-counter-finance/kyc-for-otc-clients.html)
- Desks often require clients to pre-declare deposit, withdrawal, and settlement wallets, validate them with blockchain analytics, and cap per-trade size until a wallet history is established — [Elliptic, OTC monitoring controls](https://www.elliptic.co/corpus/gen-2630/over-the-counter-finance/otc-crypto-desk-due-diligence-and-transaction-monitoring-controls.html)
- Institutional onboarding typically includes entity verification, beneficial-ownership disclosure, source-of-funds documentation, and sometimes a trading-strategy assessment — [Luno institutional guide](https://www.luno.com.ng/newsroom/the-institutional-investors-guide-to-crypto-otc-trading-on-luno)
- Example minimums (vendor marketing, not standards): $250,000 at one desk; $50K-$100K typical; seven figures for institutional conduits — [Fuze Finance](https://fuze.finance/blog/what-is-crypto-otc-desk); [Safeheron](https://safeheron.com/blog/top-otc-brokers-for-cryptocurrency-trading)
- The FTC alleged that Celsius promised to be "safer" than banks, advertised a $750M insurance policy, and overstated yields and withdrawal access. This illustrates the risk of overclaiming to high-value customers — [FTC Celsius complaint](https://www.ftc.gov/system/files/ftc_gov/pdf/2223137celsiusnetworkcomplaint.pdf)

### Inferences
- UX implications:
  - a "Large transaction / OTC" path should be a request-for-contact form, not instant execution;
  - show the steps that would be required (enhanced verification, source-of-funds documents, wallet pre-registration, manual review, settlement after funds clear) and give no guaranteed timeline;
  - do not imply any minimum or maximum is regulatory; label all limits "illustrative."
- For crypto-to-cash at large sizes, the cash-payout limit should be much lower than bank-wire payout limits. Bank wire should be the default for large tickets.

### Gaps
- No US regulator guidance specific to crypto OTC desk EDD was found. FinCEN's CDD Rule (beneficial ownership) applies to banks and certain institutions, and its application to MSBs is unverified here. Sources in this section are vendor content.

## 7. Language for a pre-launch/mock site: what to use and avoid; FTC and FDIC rules on deceptive fintech claims

### Takeaway
Never state or imply licensure, registration, FDIC/SIPC insurance, bank status, "guaranteed" or "instant" settlement, "safe/no risk," or anonymity. The FDI Act bars anyone from representing that an uninsured product is FDIC-insured, and the FDIC has sent cease-and-desist letters to crypto firms (from Aug 2022). The FTC treats safety and insurance overclaims by crypto platforms as deceptive under Section 5 (Celsius: complaint July 2023; founders' settlement totaling $16.5M reported July 2026). A mock site should carry a persistent "demonstration only" banner and use conditional, future-tense copy.

### Cited Findings
- The FDI Act prohibits any person from representing or implying that an uninsured product is FDIC-insured, and from using "FDIC" in names or ads to suggest insurance.
  - **Aug 2022:** the FDIC sent C&D letters to FTX US and four others; later letters went to CEX.IO, Zera Financial, and Unbanked.
  - The FDIC also investigated Voyager's claims that its assets were insured, when only the partner bank's deposits were.
  - Sources: [American Banker, Aug 2022](https://www.americanbanker.com/news/fdic-calls-out-ftx-us-other-crypto-firms-over-insurance-claims); [Investment Executive](https://www.investmentexecutive.com/news/regulation/five-crypto-firms-ordered-to-stop-false-fdic-claims/); [American Banker, CEX.IO/Zera](https://americanbanker.com/news/fdic-issues-cease-and-desist-letters-to-cex-io-zera)
- **12 CFR Part 328** (FDIC misrepresentation and sign rule, Dec 2023): compliance for most provisions was delayed to **May 1, 2025**. The digital-channel and ATM sign provisions (§§ 328.4-328.5) were extended to **Jan 1, 2027**, and a later rule references **Apr 1, 2027**. These mainly bind insured banks, but they signal scrutiny of nonbank insurance claims — [FDIC FIL: compliance date extension](https://www.fdic.gov/news/financial-institution-letters/2025/compliance-date-extension-sections-3284-and-3285-amendments); [Federal Register, Jan 29 2026](https://www.govinfo.gov/content/pkg/FR-2026-01-29/pdf/2026-01806.pdf)
- **FTC v. Celsius:** the July 2023 complaint alleged false claims that Celsius was "safer" than banks, a $750M insurance policy, false withdrawal and reserve claims, and overstated yields. In **July 2026** the founders were ordered to pay a total of $16.5M and were barred from marketing deposit/exchange/investment products — [FTC complaint PDF](https://www.ftc.gov/system/files/ftc_gov/pdf/2223137celsiusnetworkcomplaint.pdf); [FTC press release, Jul 2026](https://www.ftc.gov/news-events/news/press-releases/2026/07/founders-celsius-network-ordered-pay-165-million-resolve-ftc-charges)
- NY's required risk language: virtual currency is not legal tender, not government-backed, and not FDIC/SIPC protected — [Justia 23 NYCRR 200.19](https://regulations.justia.com/states/new-york/title-23/chapter-i/part-200/section-200-19)

### Inferences
- **Use** (mock site):
  - a persistent banner: "Demonstration prototype. Not a real service. No transactions are processed. [Project] holds no money transmitter licenses, FinCEN MSB registration, or BitLicense, and is not available to the public."
  - conditional phrasing: "A licensed operator would require…", "Planned (subject to licensing)…", "Example fee — illustrative."
  - visible placeholders: "NMLS ID: — (none)", "Licensing: Not licensed."
  - the risk language above (not legal tender; not FDIC/SIPC insured; irreversible; volatile; may be delayed or refused for compliance review);
  - scam warnings;
  - dummy data clearly labeled as such.
- **Avoid:**
  - "licensed," "regulated," "registered with FinCEN," "NMLS #…", "BitLicensed," state seals, or regulator logos;
  - "FDIC-insured," "insured," "protected," "bank," "bank-grade" (risky), "safe/secure/no risk," "guaranteed rate," "guaranteed/instant/same-day settlement," "cash at your door in 1 hour";
  - "no KYC," "anonymous," "private," "discreet," "no limits," "no reporting";
  - fake testimonials, user counts, volume stats, partner logos (banks, armored carriers, analytics vendors) without agreements, or "trusted by" claims;
  - impersonating any real exchange's branding.
- The disclaimer "This is not legal advice" belongs in the internal readiness document. The public mock site needs a "not a real service / not an offer" disclaimer instead.

### Gaps
- The general FTC guidance pages on deceptive claims and endorsements (e.g., FTC Endorsement Guides, 16 CFR Part 255, revised 2023) and the FTC's 2024 rule banning fake reviews and testimonials (16 CFR Part 465) could not be fetched or verified this session. Confirm dates and applicability.
- No CFPB 2025-2026 guidance on fintech FDIC misrepresentation was verified. The CFPB's posture changed in 2025, and its status is uncertain.
- Whether the federal market-structure legislation (CLARITY Act) or the GENIUS Act (stablecoins; referenced by MoFo re SB 97) changes federal licensing for crypto exchanges as of Oct 2026 was not researched. Flag as **uncertain** for the readiness doc.
