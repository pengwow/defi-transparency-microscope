#!/usr/bin/env node
/**
 * scripts/visual-smoke.mjs — end-to-end visual smoke test.
 *
 * Boots the full dev stack (`scripts/dev.sh`, e2e mode by default),
 * drives every nav tab in a real headless Chromium, takes a
 * screenshot of each, and asserts that the page-specific content
 * is actually visible (non-zero bounding box, not hidden by CSS).
 *
 * The unit tests in `src/__tests__/` and `src/pages/*/index.test.tsx`
 * run under jsdom with `test.css: false`, so they cannot detect
 * "rendered but invisible" bugs — exactly the class of bug that
 * hid the Liquidation page until a human reviewer noticed.  This
 * script closes that gap.
 *
 * Usage:
 *   pnpm run smoke:visual
 *   SKIP_DEV=1 pnpm run smoke:visual   # assume a dev server is already running
 *   HEADED=1   pnpm run smoke:visual   # run with a visible browser window
 *
 * Exit code:
 *   0  every tab passed the visibility check
 *   1  one or more tabs failed, or the dev server didn't come up
 *   2  Playwright / Chromium is not installed (run `npx playwright install chromium`)
 *
 * Outputs:
 *   frontend/.smoke/<tab>.png  — one screenshot per tab
 *   frontend/.smoke/report.md  — human-readable summary
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const OUT_DIR = resolve(__dirname, '..', '.smoke');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const TIMEOUT_MS = 25_000;

// ─── Tab matrix ──────────────────────────────────────────────────────────
// Each entry is the data-testid of a page-specific element that must
// be present *and* have a non-zero bounding box after the tab is
// activated.  If the page root is hidden by CSS, the inner element
// still exists in the DOM (jsdom-only tests would miss this) but
// getBoundingClientRect() returns {0,0,0,0}.
const TABS = [
  { name: 'live',       navMatch: /实时|采样|Live/i,        expect: ['live-amm-panel', 'mempool-panel'] },
  { name: 'fork',       navMatch: /实验|分叉|Fork/i,        expect: ['fork-experiment-grid', 'fork-params-panel'] },
  { name: 'liquidation',navMatch: /清算|Liquidation/i,      expect: ['liquidation-panorama-container', 'liquidation-explanation-panel'] },
  { name: 'lpil',       navMatch: /LP|LP\/IL|无常损失/i,     expect: ['lpil-grid', 'lpil-params-panel'] },
  { name: 'edu',        navMatch: /教学|Education/i,        expect: ['education-grid', 'edu-params-panel'] },
  { name: 'report',     navMatch: /报告|Report/i,           expect: ['report-grid', 'report-overview-panel'] },
];

// ─── Bootstrap ────────────────────────────────────────────────────────────
async function main() {
  // Detect playwright.  We do this up front so the user gets a clear
  // message instead of a confusing import error.
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch (err) {
    console.error('✗ playwright is not installed.');
    console.error('  Install it with:  pnpm add -D playwright && npx playwright install chromium');
    process.exit(2);
  }

  await mkdir(OUT_DIR, { recursive: true });

  // Optionally spawn the dev server.
  let devProc = null;
  if (!process.env.SKIP_DEV) {
    console.log('[smoke] spawning dev.sh (e2e mode)…');
    devProc = spawn(resolve(REPO_ROOT, 'scripts', 'dev.sh'), [], {
      cwd: REPO_ROOT,
      env: { ...process.env, BACKEND_MODE: 'e2e' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    // Pipe server output through a [dev] prefix so failures are
    // diagnosable.  We do not exit on server log lines — let the
    // HTTP probe decide whether the server is up.
    devProc.stdout.on('data', (b) => process.stdout.write(`[dev] ${b}`));
    devProc.stderr.on('data', (b) => process.stderr.write(`[dev] ${b}`));
  } else {
    console.log(`[smoke] SKIP_DEV=1 — assuming ${FRONTEND_URL} is already up`);
  }

  // Wait for the frontend to respond.
  const up = await waitForUrl(FRONTEND_URL, TIMEOUT_MS);
  if (!up) {
    console.error(`✗ dev server did not become ready at ${FRONTEND_URL}`);
    if (devProc) devProc.kill('SIGTERM');
    process.exit(1);
  }
  console.log(`[smoke] dev server up at ${FRONTEND_URL}`);

  // Drive the browser.
  const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const results = [];
  try {
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
    // Wait for the app shell (header + nav) to mount.
    await page.waitForSelector('[data-testid="app-header"]', { timeout: 10_000 });

    for (const tab of TABS) {
      const result = await runTab(page, tab);
      results.push(result);
    }
  } finally {
    await browser.close();
    if (devProc) devProc.kill('SIGTERM');
  }

  // Write the markdown report.
  const md = renderReport(results);
  await writeFile(resolve(OUT_DIR, 'report.md'), md, 'utf8');

  // Console summary.
  const failed = results.filter((r) => !r.ok);
  console.log('');
  for (const r of results) {
    const tag = r.ok ? '✓' : '✗';
    console.log(`  ${tag} ${r.name.padEnd(12)}  ${r.summary}`);
  }
  console.log('');
  console.log(`[smoke] screenshots → ${OUT_DIR}`);
  console.log(`[smoke] report      → ${resolve(OUT_DIR, 'report.md')}`);

  process.exit(failed.length ? 1 : 0);
}

// ─── Per-tab check ────────────────────────────────────────────────────────
async function runTab(page, tab) {
  const errors = [];
  let clicked = false;
  try {
    const tabBtn = page.getByRole('tab', { name: tab.navMatch }).first();
    await tabBtn.click({ timeout: 5_000 });
    clicked = true;
  } catch (err) {
    errors.push(`could not click tab: ${err.message.split('\n')[0]}`);
  }

  // Screenshot whatever the page looks like right now.
  const shot = resolve(OUT_DIR, `${tab.name}.png`);
  try {
    await page.screenshot({ path: shot, fullPage: true });
  } catch (err) {
    errors.push(`screenshot failed: ${err.message.split('\n')[0]}`);
  }

  // Visibility check: each expected testid must be present *and*
  // have a non-zero bounding box.  This is the part that catches
  // "DOM exists but hidden by CSS" — which is exactly what hid the
  // Liquidation page until a human reviewer noticed.
  const visibility = [];
  for (const testId of tab.expect) {
    try {
      const loc = page.locator(`[data-testid="${testId}"]`);
      const visible = await loc.isVisible();
      const box = await loc.boundingBox();
      const ok = visible && box && box.width > 0 && box.height > 0;
      visibility.push({ testId, ok, box });
      if (!ok) {
        errors.push(
          `${testId} ${visible ? 'has zero size' : 'is not visible'} (${JSON.stringify(box)})`,
        );
      }
    } catch (err) {
      visibility.push({ testId, ok: false, box: null });
      errors.push(`${testId}: ${err.message.split('\n')[0]}`);
    }
  }

  return {
    name: tab.name,
    clicked,
    shot,
    visibility,
    errors,
    ok: clicked && errors.length === 0,
    summary:
      errors.length === 0
        ? `${tab.expect.length} elements visible`
        : errors.join('; '),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────
async function waitForUrl(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function renderReport(results) {
  const lines = ['# Visual smoke report', ''];
  for (const r of results) {
    lines.push(`## ${r.ok ? '✓' : '✗'} ${r.name}`);
    lines.push('');
    lines.push(`- Screenshot: \`${r.shot}\``);
    lines.push('- Visibility:');
    for (const v of r.visibility) {
      const sz = v.box ? `${Math.round(v.box.width)}×${Math.round(v.box.height)}` : '—';
      lines.push(`  - \`${v.testId}\`: ${v.ok ? 'ok' : 'FAIL'} (${sz})`);
    }
    if (r.errors.length) {
      lines.push('- Errors:');
      for (const e of r.errors) lines.push(`  - ${e}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

main().catch((err) => {
  console.error('[smoke] crashed:', err);
  process.exit(1);
});
