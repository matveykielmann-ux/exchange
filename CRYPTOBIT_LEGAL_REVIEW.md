# CryptoBit Exchange — legal audit & owner-package status

**Last updated:** 2026-10-16 (owner package applied)  
**Owner-declared document effective date:** **2026-03-01** (`effectiveDate: "2026-03-01"` on all 14 customer legal documents, version **3.0.0**).  
**Not counsel-approved.** Removing the draft banner and setting an owner-declared effective date does **not** mean a lawyer has approved the texts.

This file supersedes the prior investigation-only snapshot for tracking. Historical CLA numbers from the audit are retained below with status.

---

## Owner package applied (summary)

| Area | Decision applied |
| --- | --- |
| Effective date | 2026-03-01; UI shows “In effect from …”; draft banner hidden when all docs have effectiveDate and no `review` blocks |
| Contacts | Telegram + in-app only; `support@example.com` removed |
| Rate | Confirm locks quote; 60s TTL; 30m deposit window; CoinGecko only; late → manual review + consent to new quote |
| Fees | Sell 3% / buy 2%; wire $30 = estimated bank fee (not CryptoBit revenue); courier individual |
| Returns | Support-only; manual admin; return exchange fee if collected; Service bears bank/network costs; no fixed return fee table |
| Crypto ops | CRM wallets + manual verify; explorers not controlled; assets table synced |
| KYC | Quote/signup/order before KYC; payout/refund may still require verification |
| Signup | US state (50 states); no country field; primary market US |
| Password | Min 8 characters |
| Cards / Privacy | Encrypted PAN + audited reveal; no “never store / tokenization” claim; no PCI claim |
| Cash | Individual quote kept; real cash still gated by compliance |

---

## CLA status after owner package

### Closed by owner decision + code/text sync

CLA-03, 04, 05, 06, 07, 08, 09, 10, 11, 12 (hedge/5% removed from Rules), 16, 17, 18 (card flows described), 24 (email removed), 25 (effective date set — **owner-declared only**), 34/cookies partial, 37 (typos), 38 (dates aligned), 40 (banner logic), 41 (homepage softened), 42, 43, 50, plus password/KYC-gate items.

**Count closed in this package:** ~28 CLA topics (see `LEGAL_REVIEW.md` “Resolved by owner business decision”).

### Remaining — need confirmed fact or document

| CLA / LR | What is still needed | Who |
| --- | --- | --- |
| CLA-01 / LR-18 | Registered + mailing address | Owner |
| CLA-02 / LR-04,32,33 | FinCEN / state licenses / NMLS (no false claims today) | Owner + Counsel |
| CLA-13 / LR-40 | Full owner-supplied AML/CTF policy (if beyond Section 8 + notice) | Owner |
| CLA-14 / LR-40 | Distinct owner Privacy if current notice is insufficient for counsel | Owner + Counsel |
| CLA-15 / LR-11,20 | Named contracted providers (KYC, screening, payout, email, hosting) | Owner + Provider |
| CLA-21 / LR-30,47,49 | Real cash: licensing, CTR/GTO, bonded carrier, photo upload, safety | Owner + Counsel + Compliance |
| CLA-22 / LR-19,27 | Biometrics notice; KYC tiers/limits | Counsel + Compliance |
| CLA-32 / LR-21,22,23,24 | Retention, hosting, GLBA/CCPA, dedicated privacy contact | Counsel + Owner |
| CLA-36 / LR-12 | Trademark clearance | Owner + Counsel |
| CLA-48 | Formal retention schedule for proofs/KYC/card data | Compliance + Counsel |

### Remaining — need legal evaluation (not closable by engineering alone)

| CLA / LR | Question for counsel |
| --- | --- |
| CLA-27 / LR-03 | Principal vs agent / title to assets |
| CLA-28 / LR-09 | USD segregation / originating bank disclosure |
| CLA-29 / LR-10 | Reg E / Remittance applicability |
| CLA-30 / LR-17 | Unclaimed property |
| CLA-31 / LR-05 | State-mandated disclosures |
| CLA-33 / LR-25,46 | E-SIGN vs Panama governing law; paper copies |
| CLA-23 / LR-44 | Which sanctions lists to name |
| CLA-26 / LR-16 | Material-change notice / re-acceptance |
| CLA-35 / LR-31 | Accessibility evaluation |
| CLA-45 | Meaning of Section 7 “24 hour warranty” |
| CLA-46 / §11 | Complaints to PSPs before support vs mandatory rights |
| CLA-47 | Whether informational docs need acceptance |
| CLA-51 | Explicit non-US availability policy beyond support channel |

### Steps before real cash operations

1. Licensing analysis per service area.  
2. CTR / aggregation / GTO procedures.  
3. Contracted licensed bonded carrier + insurance.  
4. In-person ID + audit trail; photo/count upload or equivalent.  
5. Safety protocols; counsel review of cash terms.  
6. Sign-off in `docs/compliance-readiness.md` §6; credentials + real-money gates.

---

## Why the draft banner can be absent now

`PendingReviewNotice` in `src/pages/LegalPages.tsx` shows only if a document lacks `effectiveDate` or still has `{ type: 'review' }` blocks. After this package, all 14 documents have `effectiveDate: "2026-03-01"` and in-document review callouts were removed. **Absence of the banner ≠ counsel approval.** Remaining issues live in this register and `LEGAL_REVIEW.md`.

---

## Re-acceptance

Versions for signup/order documents are **3.0.0**. The server records acceptance by slug+version. Users who accepted 2.x will need to accept 3.0.0 on the next flow that requires those documents. No historical acceptance rows were modified.
