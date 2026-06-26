/**
 * scripts/coverage-check.ts
 *
 * Verifies per-glob coverage targets from the v8 json-summary output
 * produced by `pnpm test:coverage`. Exits 0 if all targets met,
 * non-zero otherwise. Complements vitest's global thresholds
 * (which are not glob-aware) by enforcing the spec §11 targets:
 *
 *   - src/chain/**       ≥ 80% lines
 *   - src/experiments/** ≥ 90% lines
 *   - src/routes/**      ≥ 70% lines
 *
 * Usage:  pnpm coverage:check
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

interface V8SummaryEntry {
  lines: { total: number; covered: number; pct: number };
  statements: { total: number; covered: number; pct: number };
  functions: { total: number; covered: number; pct: number };
  branches: { total: number; covered: number; pct: number };
}

type V8Summary = Record<string, V8SummaryEntry>;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SUMMARY = path.resolve(HERE, '..', 'coverage', 'coverage-summary.json');

interface Target {
  glob: string;
  threshold: number;
  label: string;
}

const TARGETS: Target[] = [
  { glob: 'src/chain/', threshold: 80, label: 'chain/*        (spec §11)' },
  { glob: 'src/experiments/', threshold: 90, label: 'experiments/*  (spec §11)' },
  { glob: 'src/routes/', threshold: 70, label: 'routes/*       (spec §11)' },
];

function loadSummary(): V8Summary {
  try {
    return JSON.parse(readFileSync(SUMMARY, 'utf8')) as V8Summary;
  } catch (err) {
    console.error(
      `✗ Could not read ${SUMMARY}.\n` +
        `  Run \`pnpm test:coverage\` first to generate the summary.\n` +
        `  Underlying error: ${(err as Error).message}`,
    );
    process.exit(2);
  }
}

interface Aggregate {
  covered: number;
  total: number;
}

const aggregates = new Map<string, Aggregate>();
for (const t of TARGETS) {
  aggregates.set(t.glob, { covered: 0, total: 0 });
}

let grandCovered = 0;
let grandTotal = 0;

const summary = loadSummary();

for (const [file, metrics] of Object.entries(summary)) {
  // Skip the "total" pseudo-entry that v8 emits.
  if (file === 'total') continue;
  for (const target of TARGETS) {
    if (file.includes(target.glob)) {
      const agg = aggregates.get(target.glob)!;
      agg.covered += metrics.lines.covered;
      agg.total += metrics.lines.total;
    }
  }
  grandCovered += metrics.lines.covered;
  grandTotal += metrics.lines.total;
}

let failed = 0;

console.log('\nPer-glob line coverage (spec §11):\n');
for (const target of TARGETS) {
  const agg = aggregates.get(target.glob)!;
  if (agg.total === 0) {
    console.log(`  - ${target.label.padEnd(34)}  (no files matched ${target.glob})`);
    continue;
  }
  const pct = (agg.covered / agg.total) * 100;
  const ok = pct >= target.threshold;
  const marker = ok ? '✓' : '✗';
  console.log(
    `  ${marker} ${target.label.padEnd(34)}  ${pct.toFixed(2).padStart(6)}%  ` +
      `(target ${target.threshold}%, files matched: ${agg.total > 0 ? 'yes' : 'no'})`,
  );
  if (!ok) failed++;
}

const overall = grandTotal === 0 ? 0 : (grandCovered / grandTotal) * 100;
console.log(`\nOverall line coverage: ${overall.toFixed(2)}%\n`);

if (failed > 0) {
  console.error(`✗ ${failed} per-glob target(s) failed.`);
  process.exit(1);
}
console.log('✓ All per-glob coverage targets met.');
