#!/usr/bin/env node
/**
 * Visual QA runner. See ../SKILL.md. Uses Playwright's bundled Chromium
 * (PLAYWRIGHT_BROWSERS_PATH) — never downloads browsers.
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT = process.env.QA_OUT ?? 'qa-output';
// QA_SCHEME=dark runs every check with the OS set to dark mode (the app follows it).
const SCHEME = process.env.QA_SCHEME === 'dark' ? 'dark' : 'light';
const WIDTHS = [1440, 1024, 768, 390];
const HEIGHT = { 1440: 900, 1024: 768, 768: 1024, 390: 844 };
const PAGES = (
  process.env.QA_PAGES ??
  '/,/exchange,/large-transactions,/cash-delivery,/fees,/how-it-works,/security,/faq,/help,/legal,/signin,/signup,/nope-404'
)
  .split(',')
  .filter(Boolean);
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

async function ensureServer() {
  if (await reachable(BASE_URL)) return null;
  const child = spawn('pnpm', ['exec', 'vite', '--port', '5173', '--strictPort'], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await reachable(BASE_URL)) return child;
  }
  child.kill();
  throw new Error(`Server did not start at ${BASE_URL}`);
}

function instrument(page, where, sink) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') sink.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => sink.pageErrors.push(String(err)));
  page.on('requestfailed', (req) => sink.failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`));
  page.on('response', (res) => {
    if (res.status() >= 400) sink.failedRequests.push(`${res.status()} ${res.url()}`);
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

async function scanPages(browser) {
  for (const width of WIDTHS) {
    await mkdir(`${OUT}/${width}`, { recursive: true });
    const context = await browser.newContext({ viewport: { width, height: HEIGHT[width] }, reducedMotion: 'reduce', colorScheme: SCHEME });
    for (const route of PAGES) {
      const page = await context.newPage();
      const where = `${route} @${width}`;
      const sink = { consoleErrors: [], pageErrors: [], failedRequests: [] };
      const flush = instrument(page, where, sink);
      await page.goto(BASE_URL + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(700); // allow mock latency to settle
      const ov = await overflow(page);
      if (ov) fail(where, `horizontal overflow ${ov.scrollWidth}px > ${ov.innerWidth}px (${ov.offenders.join(', ')})`);
      const h1Count = await page.locator('main h1').count();
      if (h1Count !== 1) fail(where, `expected exactly one <h1> in main, found ${h1Count}`);
      const violations = width === 1440 || width === 390 ? await axe(page, where) : [];
      await page.screenshot({ path: `${OUT}/${width}/${slug(route)}.png`, fullPage: true });
      flush();
      report.pages.push({ route, width, overflow: ov, axe: violations, ...sink });
      await page.close();
    }
    await context.close();
  }
}

async function keyboardChecks(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: SCHEME });
  const page = await context.newPage();
  await page.goto(BASE_URL + '/', { waitUntil: 'networkidle' });
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
  const back = await page.evaluate(() => document.activeElement?.classList.contains('menu-button'));
  if (!back) fail('keyboard', 'focus did not return to the Menu button after closing');
  await context.close();
}

async function flow(browser, width) {
  const dir = `${OUT}/flow`;
  await mkdir(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width, height: HEIGHT[width] }, reducedMotion: 'reduce', colorScheme: SCHEME });
  const page = await context.newPage();
  const where = `flow @${width}`;
  const sink = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  const flush = instrument(page, where, sink);
  const shot = (name) => page.screenshot({ path: `${dir}/${width}-${name}.png`, fullPage: true });
  const expectText = async (text, label) => {
    try {
      await page.getByText(text, { exact: false }).first().waitFor({ timeout: 8000 });
    } catch {
      fail(where, `expected "${text}" (${label})`);
    }
  };

  // Sign up
  await page.goto(BASE_URL + '/signup', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Create account' }).click();
  await expectText('Fix the following to continue', 'signup validation summary');
  await shot('01-signup-errors');
  await page.getByLabel('Full legal name').fill('Jordan Rivera');
  await page.getByLabel('Email').fill(`qa${width}@example.com`);
  await page.getByLabel('Password').fill('correct-horse-battery');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/account');
  // Routes are lazy-loaded: let the chunk finish before navigating away.
  await page.getByText('Identity verification').first().waitFor();

  // Step 1: amount — below minimum, then above retail max, then valid
  await page.goto(BASE_URL + '/exchange', { waitUntil: 'networkidle' });
  // Asset and network are shadcn Selects: open the trigger, then pick the option.
  await page.getByLabel('Asset').click();
  await page.getByRole('option', { name: /^USDT/ }).click();
  await page.getByLabel('Network').click();
  await page.getByRole('option', { name: /^Tron/ }).click();
  const amount = page.getByLabel('Amount to sell');
  await amount.fill('10');
  await expectText('Minimum is $50.00', 'below minimum');
  await amount.fill('40000');
  await expectText('online limit', 'above retail maximum');
  await shot('02-amount-over-limit');
  await amount.fill('2500');
  await expectText('Send only on Tron (TRC-20)', 'network warning');
  await page.waitForTimeout(600);
  await shot('03-amount');
  await page.getByRole('button', { name: /Continue to payout/ }).click();

  // Step 2: payout — courier must be disabled
  const courier = page.getByRole('radio', { name: /Cash by courier/ });
  if (!(await courier.isDisabled())) fail(where, 'courier option must be disabled');
  await page.getByRole('radio', { name: /Bank transfer/ }).check();
  await shot('04-payout');
  await page.getByRole('button', { name: /Continue to details/ }).click();

  // Step 3: details — validation, bank account, refund address
  await page.getByRole('button', { name: /Review quote/ }).click();
  await expectText('Choose where to send your dollars', 'destination required');
  await page.getByRole('button', { name: 'Add a bank account' }).click();
  await page.getByLabel('Routing number').fill('123456789');
  await page.getByLabel('Account number').fill('000123456789');
  await page.getByRole('button', { name: 'Save bank account' }).click();
  await expectText('fails the ABA checksum', 'routing checksum');
  await page.getByLabel('Routing number').fill('011000015');
  await page.getByRole('button', { name: 'Save bank account' }).click();
  await expectText('ending 6789', 'saved destination last4');
  await page.getByLabel(/Refund address/).fill('not-an-address');
  await page.getByLabel(/Refund address/).blur();
  await expectText("doesn't look like a Tron address", 'refund address validation');
  await page.getByLabel(/Refund address/).fill('TJYeasTPa6gpEEfYqP8zm3gn9H8TCh8Qe1');
  await shot('05-details');
  await page.getByRole('button', { name: /Review quote/ }).click();

  // Step 4: review — verification gate, acknowledgements, confirm
  await expectText('Verify your identity to confirm', 'kyc gate');
  const confirm = page.getByRole('button', { name: /^Confirm exchange/ });
  if (!(await confirm.isDisabled())) fail(where, 'confirm must be disabled before verification');
  await page.getByRole('button', { name: 'Run simulated verification' }).click();
  await expectText('Expires in', 'quote countdown');
  const boxes = page.getByRole('checkbox');
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await shot('06-review');
  // Hold-to-confirm: a quick click must not submit; a one-second hold does.
  await confirm.click();
  await page.waitForTimeout(400);
  if (!page.url().includes('/exchange')) fail(where, 'a quick click submitted the exchange without a hold');
  await confirm.hover();
  await page.mouse.down();
  await page.waitForTimeout(1300);
  await page.mouse.up();
  await page.waitForURL('**/transactions/tx_*');
  await expectText('MOCK-USDT-TRON-', 'placeholder deposit address');
  await shot('07-awaiting-deposit');

  // Advance through the state machine
  const advance = page.getByRole('button', { name: /^Advance/ });
  for (let i = 0; i < 8 && (await advance.count()); i++) {
    await advance.click();
    await page.waitForTimeout(500);
    if (i === 1) await shot('08-confirming');
  }
  await expectText('Payout sent. Reference MOCK-PAYOUT-', 'completed log entry');
  await shot('09-completed');
  const heading = await page.locator('main h1').textContent();
  if (heading?.trim() !== 'Completed') fail(where, `final status heading was "${heading}"`);

  // History lists it
  await page.goto(BASE_URL + '/transactions', { waitUntil: 'networkidle' });
  await expectText('Sold 2,500.00 USDT', 'history entry');
  await shot('10-history');
  const ov = await overflow(page);
  if (ov) fail(where, `history overflow ${ov.scrollWidth}px`);
  flush();
  report.flow.push({ width, ...sink });
  await context.close();
}

const server = await ensureServer();
const browser = await chromium.launch();
try {
  await scanPages(browser);
  await keyboardChecks(browser);
  await flow(browser, 1440);
  await flow(browser, 390);
} catch (e) {
  fail('runner', e instanceof Error ? e.stack : String(e));
} finally {
  await browser.close();
  if (server) process.kill(-server.pid);
}

report.failures = failures;
await mkdir(OUT, { recursive: true });
await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
const minor = report.pages.flatMap((p) =>
  p.axe.filter((v) => v.impact !== 'serious' && v.impact !== 'critical').map((v) => `${p.route}@${p.width} ${v.id} (${v.impact})`),
);
console.log(`Visual QA: ${report.pages.length} page renders, ${report.flow.length} flow/keyboard runs.`);
if (minor.length) console.log(`Minor/moderate axe findings (not failing):\n  ${[...new Set(minor)].join('\n  ')}`);
if (failures.length) {
  console.log(`\n${failures.length} failure(s):\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('All checks passed.');
