---
name: visual-qa
description: Build-and-run Playwright visual QA for this repo against the real API server in sandbox mode — full-page screenshots of public and admin pages at 1440/1024/768/390px, console errors, failed requests, horizontal overflow, axe WCAG 2.2 AA scans, keyboard checks and the 16-step sandbox journey (customer signs up and sells, deposit simulated by signed webhooks, admin authorizes payout, support chat, completed). Use this whenever you change UI, styles, copy or flow logic in this repo, before committing, or when asked to screenshot, QA, test responsiveness or check accessibility — even if the user only says "check it looks right".
---

# Visual QA for Arcvale

The web app talks to the Node API server. This skill's script seeds a throwaway **sandbox** database in a temp folder, starts the built server (`dist-server/main.js`, serving `dist/`) on port 8799, and drives it with Playwright. It is the repo's source of truth for "does it render and work correctly".

## Run it

```bash
pnpm build && pnpm qa:visual        # always rebuild first: the script runs the built server
QA_PAGES=/,/fees pnpm qa:visual    # subset of public routes (admin pages still run)
QA_SCHEME=dark QA_OUT=qa-output-dark pnpm qa:visual   # same checks in the dark theme
BASE_URL=https://staging.example pnpm qa:visual       # an already running sandbox instance (must be seeded)
```

Signed-in pages keep a server-sent events stream open, so the script waits for `load` plus the page's `h1`, never for `networkidle`.

Outputs go to `qa-output/` (git-ignored):

- `qa-output/<width>/<route>.png` — full-page screenshots per viewport.
- `qa-output/flow/*.png` — each journey step (customer and admin) at 1440 and 390.
- `qa-output/report.json` — per page and viewport: console errors, page errors, failed requests, overflow, and axe violations.

The script exits non-zero if any console error, page error, failed request, horizontal overflow, axe violation (serious or critical) or flow-assertion failure occurs.

## After running

1. Read the stdout summary first. Each failure names the route and viewport.
2. **Look at the screenshots.** Automated checks miss taste problems: inspect at least the home page, the exchange steps, the order page and the admin order detail at 390 and 1440 with the Read tool. Check hierarchy, spacing rhythm, alignment of figures, and that every simulated figure carries a sandbox badge.
3. Fix, re-run, and compare against the previous screenshots before claiming a visual change is done.

## Why these checks

- **Viewports** match docs/design-spec.md §6.
- **Overflow** at 390px is the most common responsive regression.
- **axe** catches contrast, labelling and landmark errors. Manual keyboard review is still needed for focus order.
- **Journey** proves that the state machine, signed webhooks, admin authorization, live updates and support chat still hold together in a real browser against the real server.
