#!/usr/bin/env node
/**
 * Visual QA runner. See ../SKILL.md. Uses Playwright's bundled Chromium
 * (PLAYWRIGHT_BROWSERS_PATH) — never downloads browsers.
 *
 * Starts the built Arcvale server (dist/ + dist-server/, run `pnpm build`
 * first) in sandbox mode on a throwaway database, seeds it, then checks
 * every customer and admin page and runs the end-to-end sandbox journey:
 * customer order → tx hash submitted for review → sandbox autopilot
 * (signed deposit events) → admin payout authorization → autopilot
 * completion → success screen → support chat both ways; and the buy journey
 * (cash → crypto) with a demo ID upload, across a server restart.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

const PORT = Number(process.env.QA_PORT ?? 8799);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const OUT = process.env.QA_OUT ?? 'qa-output';
// QA_SCHEME=dark runs every check with the OS set to dark mode (the app follows it).
const SCHEME = process.env.QA_SCHEME === 'dark' ? 'dark' : 'light';
/** QA_LANG=ru scans every page in Russian (screenshots, overflow, axe); the English-text journeys run only in English. */
const LANG = process.env.QA_LANG === 'ru' ? 'ru' : 'en';
const WIDTHS = [1440, 1024, 768, 390];
const HEIGHT = { 1440: 900, 1024: 768, 768: 1024, 390: 844 };
const PAGES = (
  process.env.QA_PAGES ??
  '/,/exchange,/cash-delivery,/fees,/how-it-works,/security,/faq,/help,/legal,/legal/terms,/legal/privacy,/legal/kyc-aml,/legal/sanctions,/legal/risk,/legal/crypto-transactions,/legal/fees,/legal/refunds,/legal/complaints,/legal/cash-delivery,/legal/contact,/signin,/signup,/reset-password,/admin/login,/nope-404'
)
  .split(',')
  .filter(Boolean);
const ADMIN_PAGES = ['/admin/orders', '/admin/overview', '/admin/inbox', '/admin/audit', '/admin/users', '/admin/system', '/admin/sandbox'];
const STAFF_PASSWORD = 'sandbox-pass-2026';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const failures = [];
const report = { baseUrl: BASE_URL, startedAt: new Date().toISOString(), pages: [], flow: [] };
const fail = (where, what) => failures.push(`${where}: ${what}`);
const slug = (route) => (route === '/' ? 'home' : route.replace(/^\//, '').replace(/[^\w-]+/g, '_'));

async function reachable(url) {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

let serverEnv = null;

function startServer(env) {
  return spawn('node', ['--disable-warning=ExperimentalWarning', 'dist-server/main.js'], { env, stdio: 'ignore', detached: true });
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await reachable(`${BASE_URL}/api/health`)) return true;
  }
  return false;
}

/** Stops and starts the QA server on the same database: progress must survive. Returns false when the server is external. */
async function restartServer(server) {
  if (!server) return false;
  process.kill(-server.child.pid);
  for (let i = 0; i < 40 && (await reachable(`${BASE_URL}/api/health`)); i++) await new Promise((r) => setTimeout(r, 250));
  server.child = startServer(serverEnv);
  if (!(await waitForServer())) throw new Error('Server did not come back after restart');
  return true;
}

async function ensureServer() {
  if (process.env.BASE_URL) return null;
  const dir = await mkdtemp(path.join(tmpdir(), 'arcvale-qa-'));
  const env = {
    ...process.env,
    APP_MODE: 'sandbox',
    NODE_ENV: 'development',
    PORT: String(PORT),
    PUBLIC_ORIGIN: BASE_URL,
    DATABASE_PATH: path.join(dir, 'arcvale-sandbox.db'),
    LOG_LEVEL: 'warn',
  };
  const seed = spawnSync('node', ['--disable-warning=ExperimentalWarning', 'dist-server/cli.js', 'seed'], { env, encoding: 'utf8' });
  if (seed.status !== 0) throw new Error(`Seeding failed: ${seed.stderr || seed.stdout}`);
  serverEnv = env;
  const child = startServer(env);
  if (await waitForServer()) return { child, dir };
  child.kill();
  throw new Error(`Server did not start at ${BASE_URL}`);
}

/** Every Telegram support link opens the official account in a new tab without opener access. */
async function checkTelegram(page, where, label) {
  const links = page.locator('a[href="https://t.me/cryptocurrency_1exchange"]');
  const n = await links.count();
  if (!n) return fail(where, `no Telegram support link (${label})`);
  for (let i = 0; i < n; i++) {
    const a = links.nth(i);
    if ((await a.getAttribute('target')) !== '_blank' || !/noopener/.test((await a.getAttribute('rel')) ?? ''))
      fail(where, `Telegram link ${i} must open in a new tab with rel=noopener (${label})`);
  }
}

/** Waits for the order page heading to read `text`, reloading as a fallback (the live stream normally updates it). */
async function waitForHeading(page, text, where, timeout = 30_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const h = (
      await page
        .locator('main h1')
        .first()
        .textContent()
        .catch(() => '')
    )?.trim();
    if (typeof text === 'string' ? h === text : text.test(h ?? '')) return true;
    await page.waitForTimeout(1000);
    if (Date.now() > end - timeout / 2) await page.reload({ waitUntil: 'load' }).catch(() => undefined);
  }
  fail(where, `heading never became "${text}"`);
  return false;
}

function instrument(page, where, sink) {
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/status of 4\d\d/.test(msg.text())) sink.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => sink.pageErrors.push(String(err)));
  page.on('requestfailed', (req) => {
    // Navigating away cancels in-flight requests (live stream, read receipts); a cancel is not a failure.
    if (!req.url().endsWith('/api/events') && !/ERR_ABORTED/.test(req.failure()?.errorText ?? ''))
      sink.failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
  });
  page.on('response', (res) => {
    // 401 on the session probe and 4xx validation responses are part of the flows under test.
    if (res.status() >= 500) sink.failedRequests.push(`${res.status()} ${res.url()}`);
  });
  return () => {
    for (const k of ['consoleErrors', 'pageErrors', 'failedRequests']) for (const e of sink[k]) fail(where, `${k}: ${e}`);
  };
}

async function overflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    if (doc.scrollWidth <= window.innerWidth + 1) return null;
    const offenders = [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
    return { scrollWidth: doc.scrollWidth, innerWidth: window.innerWidth, offenders };
  });
}

async function axe(page, where) {
  const res = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  const serious = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  for (const v of serious)
    fail(
      where,
      `axe ${v.id} (${v.impact}): ${v.help} — ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}`,
    );
  return res.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length }));
}

/** Navigate and wait for the route to render. Signed-in pages hold an SSE stream open, so "networkidle" never settles. */
async function go(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page
    .locator('h1')
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 })
    .catch(() => undefined);
  await page.waitForFunction(() => !document.body.innerText.includes('Loading…'), null, { timeout: 10_000 }).catch(() => undefined);
}

async function signIn(page, email, password = STAFF_PASSWORD) {
  await go(page, BASE_URL + '/signin');
  // By field id, so it works in either interface language.
  await page.locator('#signin-email').fill(email);
  await page.locator('#signin-password').fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/signin'));
}

async function scan(context, routes, width, mainSelector) {
  for (const route of routes) {
    const page = await context.newPage();
    const where = `${route} @${width}`;
    const sink = { consoleErrors: [], pageErrors: [], failedRequests: [] };
    const flush = instrument(page, where, sink);
    await go(page, BASE_URL + route);
    await page.waitForTimeout(500);
    const ov = await overflow(page);
    if (ov) fail(where, `horizontal overflow ${ov.scrollWidth}px > ${ov.innerWidth}px (${ov.offenders.join(', ')})`);
    const h1Count = await page.locator(`${mainSelector} h1`).count();
    if (h1Count !== 1) fail(where, `expected exactly one <h1> in main, found ${h1Count}`);
    const violations = width === 1440 || width === 390 ? await axe(page, where) : [];
    await page.screenshot({ path: `${OUT}/${width}/${slug(route)}.png`, fullPage: true });
    flush();
    report.pages.push({ route, width, overflow: ov, axe: violations, ...sink });
    await page.close();
  }
}

async function scanPages(browser) {
  for (const width of WIDTHS) {
    await mkdir(`${OUT}/${width}`, { recursive: true });
    const options = { viewport: { width, height: HEIGHT[width] }, reducedMotion: 'reduce', colorScheme: SCHEME };
    const context = await browser.newContext(options);
    if (LANG === 'ru') await context.addInitScript(() => localStorage.setItem('cryptobit.lang', 'ru'));
    await scan(context, PAGES, width, 'main');
    await context.close();
    const staff = await browser.newContext(options);
    if (LANG === 'ru') await staff.addInitScript(() => localStorage.setItem('cryptobit.lang', 'ru'));
    const page = await staff.newPage();
    await signIn(page, 'admin@arcvale.test');
    await page.close();
    await scan(staff, ADMIN_PAGES, width, 'main');
    await staff.close();
  }
}

async function keyboardChecks(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: SCHEME });
  const page = await context.newPage();
  await go(page, BASE_URL + '/');
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => document.activeElement?.textContent?.trim());
  if (first !== 'Skip to content') fail('keyboard', `first Tab should reach skip link, got "${first}"`);
  await page.keyboard.press('Enter');
  const target = await page.evaluate(() => document.activeElement?.id || location.hash);
  report.flow.push({ step: 'skip-link', target });
  // Focus ring must be visible on a focused button.
  await page.locator('a.btn', { hasText: 'Start an exchange' }).first().focus();
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement).boxShadow);
  if (!ring || ring === 'none') fail('keyboard', 'focused button has no visible focus ring');
  // Support launcher opens with the keyboard and closes with Escape, returning focus.
  const launcher = page.locator('.support-launcher__button');
  await launcher.focus();
  await page.keyboard.press('Enter');
  if ((await launcher.getAttribute('aria-expanded')) !== 'true') fail('keyboard', 'support launcher did not open with Enter');
  await page.keyboard.press('Escape');
  if ((await launcher.getAttribute('aria-expanded')) !== 'false') fail('keyboard', 'Escape did not close the support panel');
  // Mobile menu toggles with keyboard and exposes aria-expanded.
  await page.setViewportSize({ width: 390, height: 844 });
  // The menu is a modal sheet: while open, the page behind it (trigger included) is hidden from
  // assistive tech, so hold the trigger by CSS rather than by role.
  const menu = page.locator('.menu-button');
  await menu.focus();
  await page.keyboard.press('Enter');
  if ((await menu.getAttribute('aria-expanded')) !== 'true') fail('keyboard', 'mobile menu did not open with Enter');
  const sheet = page.getByRole('dialog', { name: 'Menu' });
  try {
    await sheet.waitFor({ timeout: 3000 });
  } catch {
    fail('keyboard', 'mobile menu sheet is not exposed as a dialog named "Menu"');
  }
  await page.screenshot({ path: `${OUT}/390/_menu-open.png` });
  await page.keyboard.press('Escape');
  await sheet.waitFor({ state: 'detached', timeout: 3000 }).catch(() => fail('keyboard', 'Escape did not close the mobile menu'));
  // Radix returns focus on the frame after the sheet unmounts; allow it a moment.
  const back = await page
    .waitForFunction(() => document.activeElement?.classList.contains('menu-button'), null, { timeout: 1000 })
    .then(() => true)
    .catch(() => false);
  if (!back) fail('keyboard', 'focus did not return to the Menu button after closing');
  await context.close();
}

/**
 * The sandbox journey, end to end, as a customer and an operator in two
 * browser contexts. Numbered steps match docs/implementation-status.md.
 */
async function journey(browser, width) {
  const dir = `${OUT}/flow`;
  await mkdir(dir, { recursive: true });
  const options = { viewport: { width, height: HEIGHT[width] }, reducedMotion: 'reduce', colorScheme: SCHEME };
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const where = `journey @${width}`;
  const sink = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  const flush = instrument(page, where, sink);
  const shot = (p, name) => p.screenshot({ path: `${dir}/${width}-${name}.png`, fullPage: true });
  const step = (n, label) => report.flow.push({ width, step: n, label });
  const expectText = async (p, text, label, timeout = 8000) => {
    try {
      await p.getByText(text, { exact: false }).first().waitFor({ timeout });
    } catch {
      fail(where, `expected "${text}" (${label})`);
    }
  };

  // 1. Sign up (validation first, then a valid account with state and accepted terms).
  await go(page, BASE_URL + '/signup');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expectText(page, 'Fix the following to continue', 'signup validation summary');
  await shot(page, '01-signup-errors');
  await page.getByLabel('Full legal name').fill('Jordan Rivera');
  await page.getByLabel('Email').fill(`qa${width}-${Date.now()}@example.test`);
  await page.getByLabel('Country of residence').selectOption('US');
  await page.getByLabel('State of residence').selectOption('TX');
  await page.getByLabel('Password').fill('correct-horse-battery');
  await page.locator('#signup-territory').check();
  await page.locator('#signup-agree').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/account');
  await page.getByText('Identity verification').first().waitFor();
  step(1, 'signed up');

  // 2. Amount: below minimum, a large amount (no maximum), then valid.
  await go(page, BASE_URL + '/exchange');
  await page.getByLabel('Asset').click();
  await page.getByRole('option', { name: /^USDC/ }).click();
  await page.getByLabel('Network').click();
  await page.getByRole('option', { name: /^Ethereum/ }).click();
  const amount = page.getByLabel('Amount to sell');
  await amount.fill('10');
  await expectText(page, 'Minimum is $50.00', 'below minimum');
  await amount.fill('40000');
  await page.waitForTimeout(600);
  if (await page.getByText(/maximum|online limit/i).count()) fail(where, 'a large amount must not hit a maximum');
  await shot(page, '02-amount-large');
  await amount.fill('2500');
  await page.waitForTimeout(600);
  await checkTelegram(page, where, 'exchange form');
  await shot(page, '03-amount');
  await page.getByRole('button', { name: /Continue to payout/ }).click();
  step(2, 'amount quoted');

  // 3. Payout method: cash by courier takes a delivery address (area checked by ZIP); then the journey continues with a bank transfer.
  const courier = page.getByRole('radio', { name: /Cash by courier/ });
  if (await courier.isDisabled()) fail(where, 'courier option must be available');
  await courier.check();
  await page.getByRole('button', { name: /Continue to details/ }).click();
  await expectText(page, 'Where should the courier bring it?', 'courier details step');
  await page.getByRole('button', { name: 'Save delivery address' }).click();
  await expectText(page, 'Enter the street address', 'courier address validation');
  await page.getByLabel('Street address').fill('500 Congress Avenue');
  await page.getByLabel('City').fill('Austin');
  await page.getByLabel('State', { exact: true }).selectOption('TX');
  await page.getByLabel('ZIP code').fill('99901');
  await page.getByLabel('Phone for the courier').fill('(512) 555-0199');
  await page.getByRole('button', { name: 'Save delivery address' }).click();
  await expectText(page, 'isn’t available in 99901', 'courier area check');
  await shot(page, '04-courier-form');
  await page.getByLabel('ZIP code').fill('78701');
  await page.getByRole('button', { name: 'Save delivery address' }).click();
  await expectText(page, 'Courier to Austin, TX 78701', 'saved courier address');
  await shot(page, '04-courier-details');
  await page.getByRole('button', { name: /^Back/ }).click();
  await page.getByRole('radio', { name: /Bank transfer/ }).check();
  await shot(page, '04-payout');
  await page.getByRole('button', { name: /Continue to details/ }).click();
  step(3, 'payout method chosen');

  // 4. Details: bank account (checksum validated). No refund address: it is asked for only if a refund is needed.
  await page.getByRole('button', { name: /Review quote/ }).click();
  await expectText(page, 'Choose where to send your dollars', 'destination required');
  await page.getByRole('button', { name: 'Add a bank account' }).click();
  await page.getByLabel('Routing number').fill('123456789');
  await page.getByLabel('Account number').fill('000123456789');
  await page.getByRole('button', { name: 'Save bank account' }).click();
  await expectText(page, 'fails the ABA checksum', 'routing checksum');
  await page.getByLabel('Routing number').fill('011000015');
  await page.getByRole('button', { name: 'Save bank account' }).click();
  await expectText(page, 'ending 6789', 'saved destination last4');
  if (await page.getByLabel(/Refund address/).count()) fail(where, 'the exchange form must not ask for a refund address');
  await shot(page, '05-details');
  await page.getByRole('button', { name: /Review quote/ }).click();
  step(4, 'details entered');

  // 5. Identity verification (sandbox rules) and firm quote.
  await expectText(page, 'Verify your identity to confirm', 'kyc gate');
  const confirm = page.getByRole('button', { name: /^Confirm exchange/ });
  if (!(await confirm.isDisabled())) fail(where, 'confirm must be disabled before verification');
  await page.getByRole('button', { name: 'Verify my identity' }).click();
  await expectText(page, 'Expires in', 'firm quote countdown');
  step(5, 'verified and firm quote locked');

  // 6. Acknowledgements and hold-to-confirm.
  await page.locator('#ack-network').check();
  await page.locator('#ack-docs').check();
  await shot(page, '06-review');
  await confirm.click();
  await page.waitForTimeout(400);
  if (!page.url().includes('/exchange')) fail(where, 'a quick click submitted the exchange without a hold');
  await confirm.hover();
  await page.mouse.down();
  await page.waitForTimeout(1300);
  await page.mouse.up();
  await page.waitForURL('**/orders/ord_*');
  await expectText(page, 'MOCK-USDC-ETHEREUM-', 'placeholder deposit address');
  await shot(page, '07-awaiting-deposit');
  const orderUrl = page.url();
  step(6, 'order placed');

  // 7. The customer submits the transaction hash for review: format checked, recorded, not proof of a deposit.
  await page.getByLabel('Transaction hash (TXID)').fill('abc123');
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await expectText(page, "doesn't look like a transaction hash on Ethereum", 'tx hash format error next to the field');
  await page.getByLabel('Transaction hash (TXID)').fill('0x' + 'ab'.repeat(32));
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await expectText(page, 'Transaction hash submitted for review', 'tx hash recorded');
  await expectText(page, 'it does not confirm a deposit', 'hash is not verification');
  await checkTelegram(page, where, 'order page');
  await shot(page, '07b-hash-submitted');
  step(7, 'tx hash submitted for review, not proof');

  // 8–9. Sandbox autopilot: signed deposit events move the order (no manual buttons), survives a reload.
  await page.reload({ waitUntil: 'load' });
  await expectText(page, 'Sandbox autopilot', 'autopilot notice replaces manual controls');
  if (await page.getByRole('button', { name: 'Deposit the exact amount' }).count())
    fail(where, 'manual controls must hide under the autopilot');
  await waitForHeading(page, /Deposit observed|Confirming on-chain|Deposit confirmed|Ready for payout/, where);
  await shot(page, '08-confirming');
  await waitForHeading(page, 'Ready for payout', where, 60_000);
  await shot(page, '09-ready-for-payout');
  step(8, 'deposit observed');
  step(9, 'deposit confirmed, ready for payout');

  // 10. Customer asks support about the order (chat widget → full support page).
  await page.locator('.support-launcher__button').click();
  await page.getByRole('button', { name: 'New message' }).click();
  await page.locator('#w-subject').fill('When will my payout arrive?');
  await page.locator('#w-body').fill('Hi, my deposit is confirmed. When will the bank transfer arrive?');
  await page.getByRole('button', { name: 'Send to support' }).click();
  await expectText(page, 'When will my payout arrive?', 'conversation opened in widget');
  await shot(page, '10-chat-widget');
  step(10, 'customer message sent');

  // 11–14. Operator: sign in, find the order in the queue, authorize payout with a reason,
  // then the sandbox payout provider reports completion through a signed webhook.
  const staffCtx = await browser.newContext(options);
  const admin = await staffCtx.newPage();
  const adminSink = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  const adminFlush = instrument(admin, `${where} (admin)`, adminSink);
  await signIn(admin, 'admin@arcvale.test');
  // The order queue is the CRM home, with the orders waiting on a person first.
  await admin.waitForURL('**/admin/orders');
  await expectText(admin, 'Needs action', 'queue quick filters');
  await shot(admin, '11-admin-overview');
  const orderId = orderUrl.split('/').pop();
  await go(admin, `${BASE_URL}/admin/orders?attention=true`);
  await admin
    .getByRole('button', { name: /^Confirm payout · / })
    .first()
    .click();
  await admin.locator('.order-card').waitFor({ timeout: 8000 });
  await shot(admin, '12-admin-queue');
  await go(admin, `${BASE_URL}/admin/orders/${orderId}`);
  await admin.locator('.action-bar').getByRole('button', { name: 'Confirm payout' }).click();
  const dlg = admin.locator('.dialog');
  await dlg.locator('#reason-text').fill('');
  await dlg.getByRole('button', { name: 'Confirm payout' }).click();
  await expectText(admin, 'Write at least 4 characters', 'reason is required');
  await dlg.locator('#reason-text').fill('Deposit final, screening clear, bank details verified.');
  await dlg.getByRole('button', { name: 'Confirm payout' }).click();
  await admin.locator('.order-card__result', { hasText: 'Payout confirmed' }).waitFor({ timeout: 8000 });
  // The operator's click only submits the instruction; completion comes from the provider.
  await admin.locator('.order-status-line', { hasText: /Payout submitted|Payout processing/ }).waitFor({ timeout: 8000 });
  await shot(admin, '13-admin-payout-submitted');
  // The sandbox payout provider reports processing, then completion, through signed webhooks (autopilot).
  await admin.locator('.order-status-line', { hasText: 'Completed' }).waitFor({ timeout: 60_000 });
  await shot(admin, '14-admin-completed');
  step(11, 'operator signed in');
  step(12, 'order found in queue');
  step(13, 'payout authorized with reason');
  step(14, 'provider webhook completed the payout');

  // 15. Operator replies in the inbox; an internal note stays internal.
  await go(admin, `${BASE_URL}/admin/inbox?unread=true`);
  await admin
    .getByRole('button', { name: /When will my payout arrive/ })
    .first()
    .click();
  await admin.getByRole('radio', { name: 'Internal note' }).click();
  await admin.locator('#chat-input').fill('Checked: payout completed by provider.');
  await admin.keyboard.press('Enter');
  await expectText(admin, 'Checked: payout completed by provider.', 'internal note stored');
  await admin.getByRole('radio', { name: 'Reply to customer' }).click();
  await admin.locator('#chat-input').fill('Your payout has been completed by our payout provider.');
  await admin.keyboard.press('Enter');
  await expectText(admin, 'Sent', 'staff reply stored');
  await shot(admin, '15-admin-inbox');
  step(15, 'operator replied');

  // 16. Customer sees the completed order, the reply (live), and not the internal note.
  await go(page, orderUrl);
  await page.locator('main h1', { hasText: /^Completed$/ }).waitFor({ timeout: 8000 });
  await expectText(page, 'Completed (demo)', 'success screen badge');
  await expectText(page, 'Next steps', 'success screen next steps');
  await checkTelegram(page, where, 'success screen');
  await shot(page, '16-completed');
  await go(page, `${BASE_URL}/support`);
  await page
    .getByRole('button', { name: /When will my payout arrive/ })
    .first()
    .click();
  await expectText(page, 'Your payout has been completed by our payout provider.', 'customer sees reply');
  if ((await page.getByText('Checked: payout completed by provider.').count()) > 0) fail(where, 'internal note leaked to the customer');
  await shot(page, '17-customer-support');
  await go(page, `${BASE_URL}/orders`);
  await expectText(page, 'Sell 2,500.00 USDC', 'order history entry');
  const ov = await overflow(page);
  if (ov) fail(where, `orders overflow ${ov.scrollWidth}px`);
  step(16, 'customer sees completion and reply');

  flush();
  adminFlush();
  report.flow.push({ width, ...sink, admin: adminSink });
  await staffCtx.close();
  await context.close();
}

/**
 * Buy journey (cash → crypto): a customer outside the US signs up, buys USDT
 * with cash collected by courier, uploads a demo ID, the server restarts
 * mid-order, the autopilot and an operator finish it, and the success screen
 * shows the final demo amounts.
 */
async function buyJourney(browser, width, server) {
  const dir = `${OUT}/flow`;
  await mkdir(dir, { recursive: true });
  const options = { viewport: { width, height: HEIGHT[width] }, reducedMotion: 'reduce', colorScheme: SCHEME };
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const where = `buy journey @${width}`;
  const sink = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  const flush = instrument(page, where, sink);
  const shot = (p, name) => p.screenshot({ path: `${dir}/${width}-buy-${name}.png`, fullPage: true });
  const step = (n, label) => report.flow.push({ width, buy: true, step: n, label });
  const expectText = async (p, text, label, timeout = 8000) => {
    try {
      await p.getByText(text, { exact: false }).first().waitFor({ timeout });
    } catch {
      fail(where, `expected "${text}" (${label})`);
    }
  };

  await go(page, BASE_URL + '/signup');
  await page.getByLabel('Full legal name').fill('Mira Hoffmann');
  await page.getByLabel('Email').fill(`buy${width}-${Date.now()}@example.test`);
  await page.getByLabel('Country of residence').selectOption('DE');
  if (await page.getByLabel('State of residence').count()) fail(where, 'the US state field must hide outside the US');
  await page.getByLabel('Password').fill('correct-horse-battery');
  await page.locator('#signup-agree').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expectText(page, 'Confirm that you do not live in one of the listed territories', 'clause 8.5 confirmation required');
  await page.locator('#signup-territory').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/account');
  step(1, 'non-US customer signed up with the clause 8.5 confirmation');

  await go(page, BASE_URL + '/exchange');
  await page.getByRole('button', { name: 'Buy crypto with cash' }).click();
  await page.waitForURL('**/exchange?direction=buy');
  const cash = page.getByLabel('Cash you pay (USD)');
  await cash.fill('10');
  await expectText(page, 'Minimum is $50.00', 'buy minimum');
  await cash.fill('400');
  await expectText(page, 'Cash collection isn’t available for this amount', 'courier minimum');
  await cash.fill('1000');
  // The quote has arrived when Continue enables (the breakdown panel is hidden on narrow screens).
  await page.waitForFunction(() =>
    [...document.querySelectorAll('button[type=submit]')].some((b) => b.textContent.trim().startsWith('Continue') && !b.disabled),
  );
  await checkTelegram(page, where, 'buy form');
  await shot(page, '01-amount');
  await page.reload({ waitUntil: 'load' });
  if ((await page.getByLabel('Cash you pay (USD)').inputValue()) !== '1000') fail(where, 'buy draft lost on refresh');
  await page.getByRole('button', { name: /^Continue/ }).click();
  step(2, 'buy quote shown; draft survives refresh');

  await expectText(page, 'Where should the courier collect the cash?', 'collection step');
  await page.getByLabel('Street address').fill('500 Congress Avenue');
  await page.getByLabel('City').fill('Austin');
  await page.getByLabel('State', { exact: true }).selectOption('TX');
  await page.getByLabel('ZIP code').fill('78701');
  await page.getByLabel('Phone for the courier').fill('(512) 555-0199');
  await page.getByRole('button', { name: 'Save collection address' }).click();
  await expectText(page, 'Courier to Austin, TX 78701', 'saved collection address');
  const wallet = page.getByLabel(/wallet address/);
  await wallet.fill('0x52908400098527886E0F7030069857D2E4169EE7');
  await wallet.blur();
  await expectText(page, "doesn't look like a Tron address", 'wallet validated next to the field');
  await wallet.fill('TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE');
  await shot(page, '02-details');
  await page.getByRole('button', { name: /Review quote/ }).click();
  step(3, 'collection address and wallet entered');

  await page.getByRole('button', { name: 'Verify my identity' }).click();
  await expectText(page, 'Expires in', 'firm buy quote');
  await page.locator('#ack-cash').check();
  await page.locator('#ack-buy-docs').check();
  await shot(page, '03-review');
  const confirm = page.getByRole('button', { name: /^Confirm exchange/ });
  await confirm.hover();
  await page.mouse.down();
  await page.waitForTimeout(1300);
  await page.mouse.up();
  await page.waitForURL('**/orders/ord_*');
  await waitForHeading(page, 'Awaiting cash collection', where);
  const reference = (await page.locator('.eyebrow .mono').first().textContent())?.trim();
  if (!/^CBX-/.test(reference ?? '')) fail(where, `unexpected order reference "${reference}"`);
  await expectText(page, 'no courier will come', 'sandbox labelled');
  await shot(page, '04-order');
  step(4, `order ${reference} placed`);

  // Demo ID upload: wrong type refused next to the field, then a PNG is checked and discarded.
  await page.locator('#id-file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await page.getByRole('button', { name: 'Upload ID' }).click();
  await expectText(page, 'Upload a JPEG, PNG or PDF file.', 'file type validated');
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(256, 7)]);
  await page.locator('#id-file').setInputFiles({ name: 'test-id.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: 'Upload ID' }).click();
  await expectText(page, 'checked and discarded', 'upload recorded');
  await shot(page, '05-id-uploaded');
  step(5, 'demo ID uploaded');

  // Server restart: the order, its status and the autopilot carry on.
  const restarted = await restartServer(server);
  await page.reload({ waitUntil: 'load' });
  await expectText(page, reference ?? 'CBX-', 'order survives a server restart', 15_000);
  step(6, restarted ? 'server restarted; order intact' : 'external server: restart skipped');

  await waitForHeading(page, 'Ready to send crypto', where, 60_000);
  await checkTelegram(page, where, 'buy processing');
  await shot(page, '06-ready');
  step(7, 'cash collected and verified by signed cash events');

  const staffCtx = await browser.newContext(options);
  const admin = await staffCtx.newPage();
  const adminSink = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  const adminFlush = instrument(admin, `${where} (admin)`, adminSink);
  await signIn(admin, 'admin@arcvale.test');
  await admin.waitForURL('**/admin/orders');
  const orderId = page.url().split('/').pop();
  await go(admin, `${BASE_URL}/admin/orders/${orderId}`);
  await expectText(admin, 'Buy · cash → crypto', 'admin sees the direction');
  await expectText(admin, 'test-id.png', 'admin sees the uploaded ID record');
  await admin.locator('.action-bar').getByRole('button', { name: 'Confirm payout' }).click();
  await admin.locator('.dialog #reason-text').fill('Cash counted and verified; sending USDT.');
  await admin.locator('.dialog').getByRole('button', { name: 'Confirm payout' }).click();
  await admin.locator('.order-status-line', { hasText: /Crypto transfer|Completed/ }).waitFor({ timeout: 15_000 });
  await shot(admin, '07-admin');
  step(8, 'operator authorized the crypto transfer');

  await waitForHeading(page, 'Completed', where, 60_000);
  await expectText(page, 'Exchange completed', 'buy success screen');
  await expectText(page, 'Completed (demo)', 'demo badge');
  await expectText(page, 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE', 'receive address on the success screen');
  await expectText(page, 'nothing was collected, sent or broadcast', 'no real-transfer claim');
  await checkTelegram(page, where, 'buy success');
  await shot(page, '08-completed');
  await go(page, `${BASE_URL}/orders`);
  await expectText(page, 'Buy ', 'order list shows the direction');
  const ov = await overflow(page);
  if (ov) fail(where, `orders overflow ${ov.scrollWidth}px`);
  step(9, 'success screen with final demo amounts');

  flush();
  adminFlush();
  report.flow.push({ width, buy: true, ...sink, admin: adminSink });
  await staffCtx.close();
  await context.close();
}

const server = await ensureServer();
const browser = await chromium.launch();
try {
  if (!process.env.QA_JOURNEY) {
    await scanPages(browser);
    if (LANG === 'en') await keyboardChecks(browser);
  }
  if (LANG === 'ru') {
    // Journeys select controls by their English text.
  } else if (process.env.QA_JOURNEY !== 'buy') {
    await journey(browser, 1440);
    await journey(browser, 390);
  }
  if (LANG === 'en' && process.env.QA_JOURNEY !== 'sell') {
    await buyJourney(browser, 1440, server);
    await buyJourney(browser, 390, server);
  }
} catch (e) {
  fail('runner', e instanceof Error ? e.stack : String(e));
} finally {
  await browser.close();
  if (server) {
    process.kill(-server.child.pid);
    await rm(server.dir, { recursive: true, force: true });
  }
}

report.failures = failures;
await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
const minor = report.pages.flatMap((p) =>
  p.axe.filter((v) => v.impact !== 'serious' && v.impact !== 'critical').map((v) => `${p.route}@${p.width} ${v.id} (${v.impact})`),
);
console.log(`Visual QA: ${report.pages.length} page renders, ${report.flow.length} flow/keyboard entries.`);
if (minor.length) console.log(`Minor/moderate axe findings (not failing):\n  ${[...new Set(minor)].join('\n  ')}`);
if (failures.length) {
  console.log(`\n${failures.length} failure(s):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('All checks passed.');
