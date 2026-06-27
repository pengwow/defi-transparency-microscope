/**
 * Regression test for the ".dtm-page hides every page root" bug.
 *
 * Background:  `demo.css` originally declared
 *
 *     .dtm-page { display: none; }
 *     .dtm-page.is-active { display: block; }
 *
 * on the assumption that NavTabs would *show / hide* pages by toggling
 * the `is-active` class.  In reality the App shell mounts / unmounts
 * the current page directly (no CSS toggling), so the default `none`
 * ended up hiding every page that forgot to add `is-active` — which
 * was Liquidation, LP/IL, Education, and Report.  LiveSamplingPage
 * was the only one that worked, and the user reported "清算页面下方
 * 什么都不显示".
 *
 * We can't load CSS into jsdom (vite.config.ts sets `test.css: false`),
 * so we parse the stylesheet source directly and assert the `display`
 * of the `.dtm-page` rule is not `none`.  The other page-root tests
 * in App.test.tsx exercise the rendered DOM as a second line of
 * defence.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEMO_CSS = resolve(__dirname, '..', 'demo.css');

/**
 * Extract the body of the first CSS rule whose selector matches
 * `selectorText`.  Tolerates multi-line declarations and comments.
 * Returns the raw declaration block (the text between `{` and `}`).
 */
function extractRuleBody(css: string, selectorText: string): string | null {
  // Escape regex meta-characters in the selector (e.g. dots, colons).
  const escaped = selectorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match: <selector> [selectors] { <body> }
  const re = new RegExp(`(^|[}\\s])${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm');
  const match = css.match(re);
  return match ? match[2] : null;
}

/**
 * Parse `name: value;` declarations out of a rule body.  Ignores
 * comments.  Last-wins on duplicates (CSS semantics).
 */
function parseDeclarations(body: string): Record<string, string> {
  const decls: Record<string, string> = {};
  const stripped = body.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([a-zA-Z-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    decls[m[1].trim()] = m[2].trim();
  }
  return decls;
}

describe('demo.css — page visibility', () => {
  const css = readFileSync(DEMO_CSS, 'utf8');

  it('declares a `.dtm-page` rule', () => {
    const body = extractRuleBody(css, '.dtm-page');
    expect(body, 'expected a `.dtm-page` rule in demo.css').not.toBeNull();
  });

  it('does not hide the page root by default (no `display: none`)', () => {
    // The plain `.dtm-page` rule must leave the element visible.
    const body = extractRuleBody(css, '.dtm-page');
    expect(body).not.toBeNull();
    const decls = parseDeclarations(body!);
    expect(decls.display, '.dtm-page must not default to display: none').not.toBe('none');
  });

  it('keeps `.dtm-page.is-active` as a no-op alias for legacy markup', () => {
    // LiveSamplingPage still uses the `is-active` class.  The rule
    // must not *hide* the page when it is present.
    const body = extractRuleBody(css, '.dtm-page.is-active');
    expect(body).not.toBeNull();
    const decls = parseDeclarations(body!);
    if (decls.display !== undefined) {
      expect(decls.display).not.toBe('none');
    }
  });
});
