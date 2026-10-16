# CryptoBit Exchange — полный аудит юридических документов и спорных условий

**Дата аудита:** 2026-10-16  
**Статус:** только исследование и систематизация. Юридические тексты, предупреждение «Ожидает юридической проверки», даты вступления в силу и отметки об утверждении **не изменялись**.  
**Это не юридическая консультация.** Выводы разделяют (а) подтверждённый факт по коду/тексту, (б) несоответствие между документами и продуктом, (в) вопрос, требующий решения владельца или оценки юриста.

Связанный внутренний реестр открытых пунктов: [`LEGAL_REVIEW.md`](LEGAL_REVIEW.md) (LR-01…LR-49). Настоящий отчёт дополняет его полной таблицей для владельца, сверкой с текущей реализацией (включая карточные потоки) и блокерами утверждения. Полезные записи LR сохранены по смыслу; номера **CLA-*** ниже — сквозная нумерация этого аудита.

---

## 1. Что проверено

### 1.1. Юридические документы клиента (источник → страница)

| # | Slug / страница | Файл | `effectiveDate` | Acceptance |
|---|-----------------|------|-----------------|------------|
| 1 | `/legal/terms` — Service Rules (публичная оферта) | `src/content/legal/source/CRYPTOBIT_EXCHANGE_SERVICE_RULES.md` → `terms.ts` | `null` | order |
| 2 | `/legal/privacy` | `src/content/legal/privacy.ts` | `null` | signup |
| 3 | `/legal/e-sign` | `src/content/legal/e-sign.ts` | `null` | signup |
| 4 | `/legal/cookies` | `src/content/legal/cookies.ts` | `null` | — |
| 5 | `/legal/risk` | `src/content/legal/risk.ts` | `null` | order |
| 6 | `/legal/crypto-transactions` | `src/content/legal/crypto-transactions.ts` | `null` | order |
| 7 | `/legal/fees` | `src/content/legal/fees.ts` | `null` | order |
| 8 | `/legal/refunds` | `src/content/legal/refunds.ts` | `null` | order |
| 9 | `/legal/kyc-aml` | `src/content/legal/kyc-aml.ts` | `null` | — |
| 10 | `/legal/sanctions` | `src/content/legal/sanctions.ts` | `null` | — |
| 11 | `/legal/complaints` | `src/content/legal/complaints.ts` | `null` | — |
| 12 | `/legal/cash-delivery` | `src/content/legal/cash-delivery.ts` | `null` | — |
| 13 | `/legal/accessibility` | `src/content/legal/accessibility.ts` | `null` | — |
| 14 | `/legal/contact` | `src/content/legal/contact.ts` | `null` | — |

Цепочка публикации: `LEGAL_DOCUMENTS` в `src/content/legal/index.ts` → `LegalDocumentPage` / `LegalIndexPage` в `src/pages/LegalPages.tsx` → API метаданных в `server/routes.ts`. Service Rules рендерятся **verbatim** из Markdown (`?raw` + SHA-256 в `terms.ts`); остальные страницы цитируют правила блоками `{ type: 'rules' }` либо собственным текстом. Блоки `{ type: 'review' }` в production **скрыты**; в sandbox показываются.

### 1.2. Метаданные и сопутствующие тексты

- `src/config/legal.ts`, `src/config/brand.ts`
- `LEGAL_REVIEW.md`, `docs/compliance-readiness.md`, `docs/production-checklist.md`, `docs/providers.md`, `docs/implementation-status.md`
- FAQ (`src/content/faq.tsx`), футер (`src/components/Layout.tsx`), главная (`src/pages/HomePage.tsx`), форма обмена / кабинет / CRM (копирайт и статусы)
- Поведение продукта: `src/domain/quote.ts`, `payout.ts`, `assets.ts`, `order.ts`, `residence.ts`; `server/services/operations.ts`, CRM credentials/wallets

### 1.3. Технические факты продукта (для сверки, не как «юридическая сила»)

| Тема | Факт в коде |
|------|-------------|
| Справочная цена | Live: CoinGecko; Coinbase/Kraken в бэкенде не подключены |
| Спред | `PRICING_POLICY.spreadBps = 0` |
| Комиссия обменника | 3% (`bps: 300`) на ACH / wire / debit; wire + `$30` bank fee |
| Курьер | Индивидуальная стоимость (`fee: quoted`), без фиксированного тарифа |
| Срок котировки | 60 с; окно депозита 30 мин |
| Фиксация курса | При принятии котировки + соблюдении окна депозита (не при N-м подтверждении) |
| Депозит/выплата | CRM: ручная выдача реквизитов, `MANUAL_DEPOSIT_CONFIRMED`, `record_manual_payout` / refund |
| Карта (buy) | Внешняя страница/инструкции из CRM; подтверждение оператором |
| Карта (sell) | PAN шифруется at rest; CVV не собирается; reveal в CRM аудируется |
| Сети | BTC, ETH, USDT ERC/TRC/**BEP-20**, USDC ERC/Solana/Base, XRP, SOL, BNB — см. `assets.ts` |
| Резидентство | Страна (+ штат для US); отказ по списку 8.5 |
| Контакты | Telegram и часы подтверждены; email `support@example.com` — заглушка |

---

## 2. Таблица спорных вопросов

| № | Документ и точное место | Текущая формулировка или проблема | Почему это спорно | Какое решение требуется от владельца | Рекомендуемый вариант | Приоритет |
|---|-------------------------|-----------------------------------|-------------------|--------------------------------------|----------------------|-----------|
| CLA-01 | `CRYPTOBIT_EXCHANGE_SERVICE_RULES.md` preamble; `src/config/legal.ts` | Юрлицо: CryptoBit Exchange, Panama, No. 155778934. **Адрес регистрации / почтовый адрес отсутствуют** (`registeredAddress: null`). | Нет адреса для уведомлений и service of process; Section 16 опирается на «official contacts». | Владелец: предоставить зарегистрированный и почтовый адрес. Юрист: подтвердить достаточность для Panama + клиентов. | Внести адреса в Rules и `legal.ts`; обновить Contact. | **Критический** |
| CLA-02 | Rules §16; contact «Registrations and licenses»; `LEGAL_REVIEW` LR-04/32/33; `docs/compliance-readiness.md` | Нет заявления о FinCEN MSB, штатных MTL/BitLicense/DFAL, NMLS. В checklist: licenses **None**. | Работа без нужной регистрации/лицензии — существенный правовой риск; география клиентов шире США. | Юрист + владелец: модель (principal/агент), MSB, штаты, гео-ограничения. | Не запускать направления, пока counsel не подтвердит позицию; синхронизировать geo-block с решением. | **Критический** |
| CLA-03 | Rules §2: «does not store cryptoassets in its own wallets… third-party providers» | CRM хранит и выдаёт **deposit wallets** оператора (`server` credentials / assign wallet). Custody-провайдер часто `not_configured`. | Текст обещает отсутствие собственных кошельков и «verified providers»; фактически адреса могут быть кошельками оператора. | Владелец: кто контролирует депозитные адреса и ликвидность. Юрист: формулировка custody/title. | Либо подключить custody и оставить формулировку, либо переписать §2 под owner-operated wallets + ручной мониторинг. | **Критический** |
| CLA-04 | Rules §5 rate fixation vs `quote.ts` `quoteTtlMs`/`depositWindowMs`; fees LR-34; terms reviewNotes | Rules: курс фиксируется при нужных confirmations, в рабочие часы, после proof of sending ≤30 мин. Сайт: lock 60 с, курс держится 30 мин с момента confirm order. | Прямое противоречие обязательств по цене перед клиентом. | Владелец: выбрать модель A (как в Rules) или B (как в продукте). | **B:** переписать §5 (и buy fiat→crypto абзац) под lock+deposit window; убрать фиксацию по confirmations/working hours **или** переделать движок под Rules (требует отдельного решения по продукту). | **Критический** |
| CLA-05 | Rules §6 formula `I (%) = (P/L − 1) × 100` vs `payout.ts` EXCHANGE_FEE 3% + wire $30; `fees.ts` | Формула комиссии от рыночной цены на момент зачисления ≠ опубликованный 3% method fee + $30 wire, spread 0. | Клиент не может однозначно понять, как считается плата. | Владелец: утвердить коммерческую модель комиссий. | Описать 3% / $30+3% / courier quoted как schedule; формулу §6 согласовать с counsel или заменить на ссылку на Fees page + quote. | **Критический** |
| CLA-06 | Rules 9.2/9.7/9.8 return fees & deadlines; refunds LR-36; `operations.ts` manual refund | Rules: до 5%, сеть (40 TRX / 0.0045 ETH / 0.0025 BNB), 100 USDT tech fee; 72 ч / 14 дн. Код: возврат полной суммы депозита, сроков нет. | Клиент может ожидать удержаний/сроков, которых система не применяет (или наоборот). | Владелец: взимать fees как в Rules **или** упростить политику под фактический full return. | Пока вручную: временно раскрыть «returns reviewed manually; schedule fees not auto-applied» — после выбора модели синхронизировать Rules+код. | **Критический** |
| CLA-07 | Rules 4.12 recalculation ±10%; crypto-transactions LR-37; order deposit exceptions | Rules: пересчёт по фактически полученному; >10% — расторжение. Код: любое отличие amount → hold/return, без пересчёта. | Разные исходы по деньгам клиента. | Владелец: пересчёт или только return. | Либо реализовать 4.12, либо изменить Rules под «exact amount only». | **Критический** |
| CLA-08 | Rules 4.11 cancel after transfer; refunds; UI Cancel | Rules разрешают отмену после перевода (с затратами §9). UI Cancel только до отправки средств. | Обещание права, которого нет в интерфейсе. | Владелец: процесс пост-депозитной отмены через support. | Описать в Rules/Refunds обязательный канал support + сроки; или дать in-app cancel после депозита с fee disclosure. | **Высокий** |
| CLA-09 | Rules 4.22 proof of sending (screenshot+TXID); wire electronic statement; LR-35 | Сайт: optional TXID / tip; движение заказа от наблюдения/ручного confirm CRM, не от upload proof. | Rules делают proof условием; продукт не принимает скриншоты. | Владелец: обязательный upload **или** ослабить 4.22. | Согласовать с manual ops: «customer tip ≠ proof; operator verifies on-chain/bank». | **Высокий** |
| CLA-10 | Rules §5 networks table vs `assets.ts`; crypto-transactions LR-38 | Rules: USDT/USDC TRC/ERC/BEP-20; confirmations BTC4/ETH·USDT·USDC21. Сайт: +USDC Solana/Base, +XRP/SOL/BNB; USDT BEP-20 есть; USDC BEP-20 нет; Solana 32 / Base 12 / XRPL 1 / BSC 15 не в Rules. | Клиент по Rules не видит полный список направлений и порогов. | Владелец: финальный список активов/сетей и confirmations. | Обновить таблицу §5 1:1 с `assets.ts` (или сузить продукт). | **Критический** |
| CLA-11 | Rules §5 CoinGecko/Coinbase/Kraken; terms reviewNote (ошибочно id LR-44) | Rules допускают три источника; код берёт **только CoinGecko**. | Вводящее в заблуждение указание провайдеров котировок. | Владелец: какие источники допустимы. | Указать «currently CoinGecko; others may be added» или подключить остальных. | **Высокий** |
| CLA-12 | Rules §5 «hedges via market orders; volatility may reach up to 5%» | В продукте нет раскрытого hedge/5% volatility band поверх 3% fee. | Неясное ценовое обязательство. | Владелец + юрист: сохранять ли оговорку. | Убрать или явно связать с quote refresh / late deposit re-quote. | **Высокий** |
| CLA-13 | Rules §8 + link `/en/kyc-aml-policy`; kyc-aml LR-40 | Детальная AML/CTF Policy **не поставлена**; редирект на notice. | Rules ссылаются на отсутствующий документ. | Владелец: предоставить политику. Юрист: утвердить. | Опубликовать owner-supplied AML/CTF; не писать «от себя». | **Критический** |
| CLA-14 | Rules §15 + `/en/privacy-policy`; privacy LR-40/45 | «Detailed» privacy не поставлена владельцем; текущая страница — черновик под §15. | Нет утверждённой privacy для Panama-оператора / US residents. | Владелец + counsel: финальный текст (GLBA/CCPA и т.д. — CLA-32). | Заменить/утвердить после counsel; обновить ссылку. | **Критический** |
| CLA-15 | Rules 8.2 crystalintelligence.com | Назван Crystal; контракт/интеграция screening не подтверждены (`SCREENING_PROVIDER_*`). | Утверждение о системе мониторинга может не соответствовать факту. | Владелец/провайдер: договор и факт использования. | Называть только реально используемых провайдеров; иначе «or other analytics at discretion» без бренда. | **Высокий** |
| CLA-16 | `privacy.ts` «Information we collect» vs «How we protect» | Collect: encrypt PAN at rest, CRM reveal audited. Security: «payout provider's tokenization… **never hold full card numbers**». | **Внутреннее противоречие** в одном документе; второе утверждение **неверно** относительно кода card payout. | Владелец: модель хранения PAN. Counsel: PCI/ответственность. | Удалить tokenization claim; оставить encrypt+mask+audited reveal+no CVV (как в collect). | **Критический** |
| CLA-17 | `privacy.ts` Residence: «your **US state** of residence» | Sign-up собирает **country** (+ state only if US) — `AuthPages.tsx` / `residence.ts`. | Неточное описание данных. | Техкоманда после решения владельца: правка текста. | «Country of residence and, if United States, state…». | **Средний** |
| CLA-18 | Card buy/sell в продукте; Rules почти не описывают card rails | Buy: CRM-issued external pay link; Sell: manual push to stored PAN. Fees page: 3% debit. | Клиент не видит в оферте порядок card pay-in/payout, ответственность процессора, отсутствие webhook. | Владелец: утвердить описание card flows. Counsel: Reg E / card network rules. | Добавить спецусловия (4.24) или раздел: external page; operator confirm; no CVV; manual payout evidence. | **Критический** |
| CLA-19 | `docs/providers.md` Card payouts: «Card numbers never reach Arcvale» | Устарело относительно manual encrypted PAN destinations. | Внутренний контракт расходится с продуктом и privacy. | Техкоманда: обновить docs после утверждения модели (не юридический текст клиента). | Разделить automatic tokenized path vs manual CRM path. | **Средний** |
| CLA-20 | Wire/ACH: CRM wire sets + manual confirm; Rules 4.20/4.22 | Реквизиты выдаёт оператор; поступление подтверждается вручную; банковские сроки — estimates. | Нужно явное распределение ответственности банк ↔ сервис ↔ клиент. | Владелец: SLA/disclosure. Counsel: Reg E / Remittance (LR-10). | Описать manual issuance + manual credit; bank delays not Service fault (уже частично 4.15). | **Высокий** |
| CLA-21 | Cash/courier: `cash-delivery.ts`; Rules 4.10; LR-30/47/49; FEATURE courier on | Нет upload фото/подсчёта; реальный cash завязан на compliance §6; Rules в основном crypto→fiat; buy cash→crypto слабо покрыт. | Высокий AML/safety; документы не готовы к real cash. | Owner/Counsel/Compliance: checklist §6. | Держать «not offered for real delivery» until sign-off; синхронизировать Rules для cash→crypto. | **Критический** (для направления cash) |
| CLA-22 | KYC notice: «third-party identity-verification provider»; LR-11/19/27 | Провайдер не назван; биометрия/BIPA open; tiers/limits open. | Нельзя честно описать CIP без провайдера и программы. | Owner + Compliance + Provider. | Назвать провайдера после контракта; counsel по biometrics; опубликовать tiers. | **Критический** |
| CLA-23 | Sanctions notice LR-44; Rules 8.5 only named territories | Нет OFAC/UN/EU lists; сервис не только для US residents; VPN ban в §11. | Неясный стандарт скрининга. | Counsel + Compliance. | Определить lists + geo/IP policy; раскрыть на уровне, который counsel считает нужным. | **Критический** |
| CLA-24 | Contact / brand: `support@example.com`; LR-39 | Официальный email — RFC 2606 placeholder; соцсети не заданы. Section 16 claims → official contacts. | Некуда направлять claims/legal notices. | Владелец: реальный email (+ опционально phone/соцсети). | Заменить во всех местах (`brand.ts`, `legal.ts`, Rules contacts). | **Критический** |
| CLA-25 | Все 14 docs: `effectiveDate: null`; Section 17; LR-48 | «Not yet in effect»; изменения Rules «effective on publication». | Документы нельзя считать вступившими в силу. | Owner + Counsel: дата после утверждения. | Выставить `effectiveDate` только после закрытия блокеров; bump versions. | **Критический** |
| CLA-26 | LR-16; privacy material changes; Rules §17 | Rules: changes effective on publication / continued use. Privacy advance notice open. | Риск необеспечимости односторонних изменений. | Counsel. | Минимальный notice period + re-accept для signup/order docs. | **Высокий** |
| CLA-27 | LR-03 structure principal vs agent; liquidity | Rules §2: exchange via third parties; profits as remuneration. | Влияет на licensing и custody disclosures. | Owner + Counsel + Provider. | Зафиксировать модель письменно; отразить в §2. | **Критический** |
| CLA-28 | LR-09 payout providers / segregation of USD | Не названы банк/payout provider; segregation open. | Customer-fund handling disclosure. | Owner + Counsel + Provider. | Не утверждать segregation/insurance без фактов. | **Высокий** |
| CLA-29 | LR-10 Reg E / Remittance Rule | Open в complaints/refunds. | Могут потребоваться обязательные disclosures/права. | **Только Counsel.** | Вопрос юристу: применяется ли EFTA/Remittance к ACH/wire/card payout. | **Критический** (оценка counsel) |
| CLA-30 | LR-17 unclaimed property / dormancy; clause 8.2 freeze 3 months | Нет процедуры escheat; frozen funds language есть. | State unclaimed-property duties. | Counsel + Owner. | Политика + сроки после counsel. | **Высокий** |
| CLA-31 | LR-05 state-mandated disclosures (NY 200.19, CA DFAL…) | Placeholders в risk/fees/complaints. | Возможны обязательные формы disclosures. | Counsel (после geo). | Добавить только после определения served states. | **Высокий** |
| CLA-32 | Privacy LR-20/21/22/23/24 | Providers list, retention, hosting, GLBA/CCPA, privacy contact — open. | Privacy нельзя финализировать. | Owner + Counsel + Provider. | Заполнить `legal.ts` + privacy sections from facts only. | **Критический** |
| CLA-33 | e-sign LR-25/46 | US E-SIGN vs Panama governing law; paper copies open. | Возможная коллизия режимов. | Counsel. | Выбрать governing e-comms law; дописать paper-copy terms. | **Высокий** |
| CLA-34 | Cookies LR-26 | Expiry `arcvale_session`/`arcvale_csrf`; имя cookie с прежним брендом. | Inventory может не совпасть с production; след шаблона Arcvale. | Owner/Tech. | Подтвердить имена/expiry; переименовать при ребрендинге. | **Средний** |
| CLA-35 | Accessibility LR-31 | Нет даты manual evaluation. | Statement может быть неточным. | Owner. | Провести оценку; обновить дату/ограничения. | **Низкий** |
| CLA-36 | Trademark LR-12 CryptoBit Exchange | Clearance open (в старом LR ещё фигурировал Arcvale). | IP риск. | Owner + Counsel. | Подтвердить владение знаком. | **Высокий** |
| CLA-37 | Rules typos 4.21/4.23/8.3 («reasongs», «Serice», «confiramtion»); LR-43 | Воспроизводятся verbatim. | Репутация/качество оферты; сайт не правит source. | Владелец: новая версия Markdown + новый SHA. | Исправить только в owner source file. | **Низкий** |
| CLA-38 | Rules «Last Updated: March 27, 2026» vs terms `lastUpdated: 2026-10-15` | Расхождение дат source vs обёртки. | Путаница, какая версия «текущая». | Owner. | Синхронизировать дату в Markdown при утверждении. | **Средний** |
| CLA-39 | ID collision: terms `reviewNotes` CoinGecko помечен `LR-44`; LEGAL_REVIEW LR-44 = sanctions | Один ID — две разные темы. | Путаница реестра. | Tech при следующем обновлении реестра (не текст клиента). | Выделить новый LR-id для market-data sources. | **Низкий** |
| CLA-40 | `PendingReviewNotice` + `hasReviewItems` только по `sections` | У `terms` `sections: []`, review в `reviewNotes` → **баннер на странице Rules может не показываться**, хотя `effectiveDate: null` и на индексе баннер есть. | Клиент на `/legal/terms` может не видеть то же предупреждение, что на индексе. | Tech после решения владельца (UI, не «утверждение»). | Считать pending также при `effectiveDate === null` и/или `reviewNotes.length`. | **Средний** |
| CLA-41 | HomePage: «Designed for regulated operation.» | Маркетинг при отсутствии подтверждённых licenses. | Риск восприниматься как заявление о регулировании. | Owner + Counsel (UDAAP/advertising). | Заменить нейтральной формулировкой до лицензий. | **Высокий** |
| CLA-42 | FAQ/i18n: местами «provisional courier fee» vs individually quoted | Часть RU/EN строк устарела относительно `payout.ts` / fees legal. | Несогласованность обязательств в FAQ. | Tech copy sync после owner confirm courier model. | Единая формулировка «calculated individually». | **Средний** |
| CLA-43 | crypto-transactions «how a sale works» step 6: «payout provider confirms» | Фактически часто `record_manual_payout` без provider webhook. | Завышает автоматизацию. | Owner. | «We record payout as sent after our team (or provider) confirms». | **Высокий** |
| CLA-44 | fees «large-transaction desk» $25k | Desk pricing описан; процесс/контакты desk не формализованы в Rules. | Может выглядеть как обещание услуги. | Owner. | Подтвердить desk process или смягчить язык. | **Средний** |
| CLA-45 | Section 7 Warranty Period 24 hours | Неясно, *что* гарантируется 24 часа. | Размытое обязательство. | Counsel + Owner. | Уточнить или удалить. | **Средний** |
| CLA-46 | Section 11: complaints to payment systems without first contacting support → restriction | Может конфликтовать с обязательными complaint/error-resolution правами (если Reg E и т.п.). | Нужна оценка counsel. | Counsel. | Согласовать с CLA-29. | **Высокий** |
| CLA-47 | Informational docs acceptance | kyc-aml, sanctions, cash-delivery, complaints — `acceptance: null`. | Counsel должен решить, что принимать при signup/order. | Counsel. | Как минимум подтвердить текущую схему signup+order. | **Средний** |
| CLA-48 | Retention of payment proofs / receipts | Legal: receipt in history; wire proof «electronic statement» в Rules; upload ограничен. | Сроки хранения proof/KYC/card data open (LR-21). | Compliance + Counsel. | Schedule по категориям данных. | **Высокий** |
| CLA-49 | Wrong address/network/amount liability | Rules 4.19, 9.9, 9.10; crypto disclosure. Код: wrong network/amount → review; recovery не гарантирован. | В целом согласовано по духу; case-by-case refuse нуждается в операционной политике. | Owner: desk policy. | Опубликовать operational policy согласованную с 9.9/9.10. | **Средний** |
| CLA-50 | Manual ops vs «automated monitoring» language in several pages | crypto-transactions / kyc говорят о systems observing deposits; production path часто manual CRM. | Завышение автоматизации. | Owner. | Честно описать hybrid: monitoring when configured; else operator verification. | **Высокий** |
| CLA-51 | `LEGAL_ENTITY.servedStates: null` vs worldwide except 8.5 | Нет позитивного списка рынков; bank/card/courier только US rails. | Резидент не-US может открыть аккаунт, но payout rails US-only. | Owner + Counsel. | Явно раскрыть: account eligibility vs payout geography. | **Высокий** |
| CLA-52 | Arcvale leftovers in code/docs (`arcvale_*` cookies, docs «Arcvale», DB names) | Следы другого рабочего имени. | Шаблонный/чужой бренд в инфраструктурных текстах. | Tech (не клиентский legal body). | Постепенно переименовать; в Cookie Policy — фактические имена cookie. | **Низкий** |

**Итого по приоритетам (уникальные CLA):** Критический **22** · Высокий **18** · Средний **9** · Низкий **3** → **52**.

Открытые пункты прежнего реестра `LEGAL_REVIEW.md` (не «Resolved» / не полностью закрытые): LR-03, 04, 05, 06, 09–12, 16–27, 29–33, 34–40, 42–49 и части LR-39 — учтены выше. Resolved LR (01, 07, 08-text, 13–15, 28, 41) не переоткрывались без новой причины; где код всё ещё расходится с «resolved in Rules» (пересчёт/return fees) — отдельные CLA-06/07.

---

## 3. Блокеры утверждения документов

Без решения следующих пунктов нельзя обоснованно считать пакет документов **окончательным** (исчезновение баннера само по себе юридической готовности не создаёт — см. §3.1).

| # | Что решить | Кто | Результат, закрывающий вопрос | Что обновить после |
|---|------------|-----|-------------------------------|--------------------|
| B1 | Юрадрес + mailing address Panama entity | Владелец (+ юрист) | Адреса в письменном виде | Rules preamble/contact, `legal.ts`, Contact page |
| B2 | Лицензии/MSB/NMLS / список рынков | Юрист + владелец | Письменная licensing memo + geo policy | Contact regulatory; Sanctions; signup geo; возможно блокировки |
| B3 | Custody model: чьи кошельки / провайдеры | Владелец + провайдер + юрист | Описание title/control of deposits | Rules §2; Risk; crypto-transactions |
| B4 | Модель цены: Rules §5 vs 60s/30m lock | Владелец | Выбор A или B + единый текст | Rules §5; fees; risk; crypto-transactions; при A — код котировок |
| B5 | Модель комиссии: §6 formula vs 3%+$30 | Владелец | Утверждённый fee schedule | Rules §6; fees; Fees UI; quotes |
| B6 | Return fees & recalculation 4.12 / 9.x | Владелец (+ юрист) | Либо внедрить, либо переписать Rules | Rules §4/9; refunds; код refund/re-quote |
| B7 | Owner-supplied AML/CTF + Privacy | Владелец → юрист | Финальные тексты политик | `/en/kyc-aml-policy`, `/en/privacy-policy` или замена notice |
| B8 | Card pay-in & card payout legal terms | Владелец + юрист (+ процессор) | Спецусловия хранения PAN / external page / manual payout | Rules или 4.24 annex; privacy security; fees; order UX copy |
| B9 | Official email (не example.com) + claims channel | Владелец | Рабочий inbox в бренде | brand/legal config; Contact; Complaints; footer |
| B10 | Sanctions lists + screening provider facts | Compliance + юрист + провайдер | Список режимов + факт скрининга | Sanctions; kyc-aml; Rules 8.2 naming |
| B11 | Identity provider + biometrics + retention | Провайдер + юрист + compliance | Контракт, notice/consent, schedule | Privacy; kyc-aml; e-sign if needed |
| B12 | Assets/networks/confirmations = product | Владелец | Таблица = `assets.ts` | Rules §5; crypto-transactions |
| B13 | Cash real-delivery gate (если направление нужно) | Owner + Counsel + Compliance | Sign-off `compliance-readiness.md` §6 | cash-delivery; fees; Rules cash clauses |
| B14 | `effectiveDate` + counsel approval record | Owner + Counsel | Дата + версия после правок | Все 14 docs metadata; acceptance re-prompt per LR-16 |
| B15 | Reg E / Remittance / governing e-sign / GLBA-CCPA | **Юрист** | Memo с обязательными disclosures | Terms-related, refunds, complaints, privacy, e-sign |

### 3.1. Почему отображается «Ожидает юридической проверки»

**Код:** `PendingReviewNotice` в `src/pages/LegalPages.tsx`.

1. На **индексе** `/legal` баннер показывается всегда (черновики, нет effective date).
2. На **странице документа** баннер показывается, если в `sections` есть хотя бы один блок `{ type: 'review' }` (`hasReviewItems`). Текст: draft awaiting counsel; если `effectiveDate == null` — «has no effective date yet»; иначе — «may change before it takes effect». В sandbox добавляется про highlighted notes; в production — «Some details are still to be confirmed.»
3. Мета документа: `Effective` → «Not yet in effect» при `effectiveDate: null` (сейчас у **всех** 14 документов).
4. RU: ключ `'Pending legal review'` → «Ожидает юридической проверки» (`src/i18n/ru-public3.ts`).

**Связанные незаполненные метаданные:** все `effectiveDate: null`; множество `review` / OWNER·COUNSEL placeholders; `LEGAL_ENTITY` null-поля (адрес, FinCEN, NMLS, licenses, complaints/privacy email); `supportEmail` placeholder.

**Важно:** снятие баннера (например, удаление `review`-блоков или смена условия UI) **не означает** юридическую готовность. Готовность = закрытие блокеров B1–B15, правка текстов по решению владельца/юриста, bump `version`, установка `effectiveDate`, запись acceptances.

---

## 4. Вопросы по темам (последовательность для владельца)

### 1. Компания и юридический статус
CLA-01, 02, 27, 28, 36, 51 · B1, B2, B3

### 2. Общие условия обмена
CLA-03, 08, 27, 43, 50 · структура сделки, cancel, manual vs automated

### 3. Курсы, комиссии и сроки
CLA-04, 05, 11, 12, 44, 45 · B4, B5

### 4. Банковские и карточные операции
CLA-16, 18, 19, 20, 29, 46 · B8, B15

### 5. Криптовалютные депозиты и выплаты
CLA-07, 09, 10, 15, 49, 50 · B3, B6, B12

### 6. Наличные и курьерская доставка
CLA-21, 42 · B13

### 7. Возвраты, отмены и споры
CLA-06, 07, 08, 30, 46 · B6

### 8. KYC/AML и ограничения
CLA-13, 15, 22, 23, 51 · B7, B10, B11

### 9. Персональные, банковские и карточные данные
CLA-14, 16, 17, 32, 33, 34, 48 · B7, B8, B11

### 10. Контакты, согласия, публикация и вступление в силу
CLA-24, 25, 26, 38, 40, 41, 47 · B9, B14

---

## 5. Вопросы владельцу — сначала (без дублей)

1. **Адрес компании** (registered + mailing) и **официальный email** (не example.com)?  
2. **Лицензии / MSB / штаты обслуживания** — есть memo юриста или работаем только как draft?  
3. **Чьи депозитные кошельки** и как описать custody (опровергнуть или подтвердить §2)?  
4. **Цена:** оставляем продукт (60 с / 30 мин) и меняем Rules §5, или наоборот?  
5. **Комиссия:** утверждаем 3% + $30 wire + courier quoted и переписываем §6?  
6. **Возвраты:** применяем fees/сроки 9.x и пересчёт 4.12 в операциях, или упрощаем Rules под full return + exact amount?  
7. **Карты:** подтверждаем модель (external pay-in link + encrypted PAN payout, no CVV) для внесения в оферту/privacy?  
8. **Провайдеры:** KYC, screening (Crystal?), payout/bank, card processor — кто законтрактован и что можно назвать клиенту?  
9. **AML/CTF Policy и Privacy Policy** — когда будут owner-supplied тексты?  
10. **Cash/courier** — остаётся выключенным для real money до compliance §6, или приоритет запуска?  
11. **Список активов/сетей/confirmations** — финальная таблица = текущий `assets.ts`?  
12. После ответов 1–11: **дата вступления в силу** и кто подписывает counsel approval?

---

## 6. Соответствие: документ ↔ приложение (сводка)

| Тема | Вердикт |
|------|---------|
| CoinGecko reference vs final quote | **Частично ок** в fees/UI; Rules допускают лишние источники и иную фиксацию курса → CLA-04/11 |
| Ручная выдача реквизитов CRM | **В коде есть**; в Rules/crypto disclosure описано слабо / как automated → CLA-43/50 |
| Ручное подтверждение депозита/выплат/возвратов | **В коде есть**; return fees Rules не применяются → CLA-06 |
| Card pay-in external + manual confirm | **В коде есть**; в Rules почти нет; privacy security противоречит PAN storage → CLA-16/18 |
| Recipient details storage | Bank encrypt + card encrypt+reveal audit — **факт**; tokenization claim — **ложь относительно кода** |
| KYC docs | UI/потоки есть; детальная AML policy отсутствует → CLA-13/22 |
| Courier individual fee | **Согласовано** fees/cash-delivery/code; FAQ местами устарел → CLA-42 |
| Wire $30 + 3% | **Согласовано** fees page ↔ `payout.ts`; не согласовано с формулой §6 → CLA-05 |
| Quote 60s / deposit 30m | **Согласовано** между site legal pages и кодом; **конфликт с Rules §5** → CLA-04 |
| Payment proofs retention | Недостаточно определено юридически → CLA-48 |
| Споры / Panama court | В Rules есть; contacts для claims неполные → CLA-01/24 |

Легенда вердикта: «юридический текст ≠ код», «код ≠ заявленные условия», «недостаточно данных» — см. колонку «Почему это спорно» в таблице. **Реализация функции в коде не делает условие юридически действительным.**

---

## 7. Финальная проверка аудита

- [x] Все 14 клиентских legal documents учтены  
- [x] Service Rules source просмотрен целиком (§1–§17)  
- [x] Существенные проблемы имеют пути к файлам / пунктам  
- [x] Предположения отделены от фактов; «незаконность» не утверждается без оснований  
- [x] Технические несоответствия опираются на код (`quote`, `payout`, `assets`, `order`, `privacy`, CRM ops)  
- [x] Юридические open questions отдельно от технических (CLA-29/31/33 vs CLA-19/39/40)  
- [x] Исходные legal texts и приложение **не изменялись** этим аудитом — добавлен только настоящий файл

---

## 8. Краткая сводка

| Метрика | Значение |
|---------|----------|
| Критический | **22** |
| Высокий | **18** |
| Средний | **9** |
| Низкий | **3** |
| Всего CLA | **52** |
| Блокеры утверждения | **15** (B1–B15) |
| Итоговый отчёт | **`CRYPTOBIT_LEGAL_REVIEW.md`** (этот файл) |
| Прежний реестр | `LEGAL_REVIEW.md` (сохранён, не заменён) |

**Проверенные файлы (основные):**  
`src/content/legal/**` (14 документов + `source/CRYPTOBIT_EXCHANGE_SERVICE_RULES.md`), `src/pages/LegalPages.tsx`, `src/config/legal.ts`, `src/config/brand.ts`, `LEGAL_REVIEW.md`, `docs/compliance-readiness.md`, `docs/production-checklist.md`, `docs/providers.md`, `src/domain/{quote,payout,assets,order,residence}.ts`, `server/services/operations.ts`, фрагменты FAQ/Home/Layout/i18n, связанные с обязательствами перед клиентом.

**Следующий шаг (отдельная задача, не этот этап):** обсуждение ответов владельца → подготовка исправленных текстов → review юриста → выставление `effectiveDate`. До тех пор предупреждение «Ожидает юридической проверки» должно оставаться.
