---
name: visual-qa
description: Launch this repo's Vite app and run Playwright visual QA — full-page screenshots at 1440/1024/768/390px, console errors, failed requests, horizontal overflow, axe WCAG 2.2 AA scans, keyboard checks and the end-to-end mock exchange journey (sign up → verify → quote → confirm → advance to completed). Use this whenever you change UI, styles, copy or flow logic in this repo, before committing, or when asked to screenshot, QA, test responsiveness or check accessibility — even if the user only says "check it looks right".
---

# Visual QA for the exchange preview

The app is a React + Vite SPA with mock services only. This skill runs the bundled script against a running server and reports problems. It is the repo's source of truth for "does it render correctly".

## Run it

```bash
pnpm qa:visual                      # starts `vite` on :5173 if nothing is listening, then runs
BASE_URL=http://localhost:4173 pnpm qa:visual   # against `pnpm build && pnpm preview`
QA_PAGES=/,/fees pnpm qa:visual    # subset of routes
```

Outputs go to `qa-output/` (git-ignored):
- `qa-output/<width>/<route>.png` — full-page screenshots per viewport.
- `qa-output/flow/*.png` — each exchange step and transaction state at 1440 and 390.
- `qa-output/report.json` — per page and viewport: console errors, page errors, failed requests, overflow, and axe violations.

The script exits non-zero if any console error, page error, failed request, horizontal overflow, axe violation (serious or critical) or flow-assertion failure occurs.

## After running

1. Read the stdout summary first. Each failure names the route and viewport.
2. **Look at the screenshots.** Automated checks miss taste problems: inspect at least the home page, the exchange steps and the transaction page at 390 and 1440 with the Read tool. Check hierarchy, spacing rhythm, alignment of figures, and that every mock figure carries a MOCK badge.
3. Fix, re-run, and compare against the previous screenshots before claiming a visual change is done.

## Why these checks

- **Viewports** match docs/design-spec.md §6.
- **Overflow** at 390px is the most common responsive regression.
- **axe** catches contrast, labelling and landmark errors. Manual keyboard review is still needed for focus order.
- **Flow** proves that the state machine, quote locking and mock adapters still hold together in a real browser.
