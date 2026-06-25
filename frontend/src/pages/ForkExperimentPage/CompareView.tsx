/**
 * CompareView — 3-branch comparison table for the opened scenario.
 *
 * The three branches model progressively more hostile conditions:
 *   1. Baseline       — no victim trade, no attacker.
 *   2. Victim-only    — victim trades, no attacker present.
 *   3. Attacker-present — full sandwich (frontrun + victim + backrun).
 *
 * The table surfaces a few headline metrics (attacker profit, victim
 * loss, step outputs) so the user can see the cost of MEV at a
 * glance.  IL-only and attribution presets fall back to a
 * "branches N/A" message since the same 3-branch decomposition does
 * not apply.
 */

import { useEffect, useState } from 'react';
import type { ExperimentPreset } from '@/services/api';
import { MockAPI } from '@/services/mockApi';
import { getAmountOut } from '@/algorithms/cpmm';
import { simulateSandwich } from '@/algorithms/sandwich';
import { formatUsd } from '@/utils/format';
import './CompareView.css';

export interface CompareViewProps {
  scenario: ExperimentPreset;
}

interface BranchRow {
  label: string;
  baseline: string;
  victimOnly: string;
  attackerPresent: string;
}

const ONE_E18 = 10n ** 18n;
/** Default victim / attacker trade sizes for the comparison. */
const DEFAULT_VICTIM_IN = 100n * ONE_E18;
const DEFAULT_ATTACKER_IN = 50n * ONE_E18;

export function CompareView({ scenario }: CompareViewProps) {
  const [rows, setRows] = useState<BranchRow[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRunning(true);
    (async () => {
      const { config } = scenario;
      const isSandwichConfig = config.name.toLowerCase().includes('sandwich');

      if (isSandwichConfig) {
        // Branch 1: no victim, no attacker — nothing to compare.
        const baselineVictimOut = 0n;
        const victimOnly = getAmountOut(DEFAULT_VICTIM_IN, config.reserve0, config.reserve1);
        const full = simulateSandwich(
          config.reserve0,
          config.reserve1,
          DEFAULT_VICTIM_IN,
          DEFAULT_ATTACKER_IN,
          BigInt(config.fee),
        );
        if (cancelled) return;
        setRows([
          {
            label: 'Victim amount in',
            baseline: '—',
            victimOnly: formatUsd(DEFAULT_VICTIM_IN),
            attackerPresent: formatUsd(DEFAULT_VICTIM_IN),
          },
          {
            label: 'Victim amount out',
            baseline: formatUsd(baselineVictimOut),
            victimOnly: formatUsd(victimOnly),
            attackerPresent: formatUsd(full.step2AmountOut),
          },
          {
            label: 'Attacker profit (token0)',
            baseline: formatUsd(0n),
            victimOnly: formatUsd(0n),
            attackerPresent: formatUsd(full.attackerProfit),
          },
          {
            label: 'Victim loss vs baseline',
            baseline: formatUsd(0n),
            victimOnly: formatUsd(0n),
            attackerPresent: formatUsd(full.victimLoss),
          },
          {
            label: 'Step 1 / 2 / 3 outputs',
            baseline: '— / — / —',
            victimOnly: '— / — / —',
            attackerPresent: `${formatUsd(full.step1AmountOut)} / ${formatUsd(full.step2AmountOut)} / ${formatUsd(full.step3AmountOut)}`,
          },
        ]);
        setRunning(false);
        return;
      }

      // For IL or attribution scenarios, run a single result via MockAPI
      // and present the summary stats as the 3-branch comparison.
      const api = new MockAPI();
      try {
        if (config.name.toLowerCase().includes('il')) {
          const res = await api.runIlExperiment({
            reserve0: config.reserve0,
            reserve1: config.reserve1,
            priceRatio: 1.5,
          });
          if (cancelled) return;
          const ilV2 = (res.summary.ilV2 as number) ?? 0;
          const ilV3 = (res.summary.ilV3 as number) ?? 0;
          setRows([
            {
              label: 'IL @ 1.5x (V2)',
              baseline: formatPct(ilV2),
              victimOnly: formatPct(ilV2),
              attackerPresent: formatPct(ilV2),
            },
            {
              label: 'IL @ 1.5x (V3)',
              baseline: formatPct(ilV3),
              victimOnly: formatPct(ilV3),
              attackerPresent: formatPct(ilV3),
            },
          ]);
        } else {
          const res = await api.runAttributionExperiment({
            reserve0: config.reserve0,
            reserve1: config.reserve1,
            amountIn: DEFAULT_VICTIM_IN,
            fee: config.fee,
          });
          if (cancelled) return;
          setRows([
            {
              label: 'Total P&L',
              baseline: formatPct((res.summary.totalE18 as number) ?? 0),
              victimOnly: formatPct((res.summary.totalE18 as number) ?? 0),
              attackerPresent: formatPct((res.summary.totalE18 as number) ?? 0),
            },
          ]);
        }
      } finally {
        if (!cancelled) setRunning(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scenario]);

  return (
    <div className="dtm-compare-view" data-testid="compare-view-root">
      <h3 className="dtm-compare-view-title">{scenario.name}</h3>
      <p className="dtm-compare-view-desc muted">{scenario.description}</p>
      {running ? (
        <p className="dtm-compare-view-running">Running comparison…</p>
      ) : (
        <table className="dtm-compare-table" role="table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Baseline</th>
              <th>Victim-only</th>
              <th>Attacker-present</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                <td className="mono">{r.baseline}</td>
                <td className="mono">{r.victimOnly}</td>
                <td className="mono">{r.attackerPresent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function formatPct(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(2)}%`;
}

export default CompareView;
