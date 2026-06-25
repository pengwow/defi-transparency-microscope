/**
 * IlMetrics — 4-column MetricGrid with the LP/IL readouts:
 *   - IL%        (closed-form V2 formula, optionally amplified by V3 concentration)
 *   - 净 PnL     (IL × depositUsd, in USD)
 *   - APR        (deterministic mock from fee tier × deposit)
 *   - 手续费收入 (fee tier × depositUsd × 365 days simplified)
 *
 * All values are derived from the `lpStore` so the metrics respond
 * immediately to slider / scenario changes.
 */

import { useMemo } from 'react';
import { MetricBox, MetricGrid } from '@/components/panels';
import { useLpStore } from '@/store/lpStore';
import { calculateV2IL } from '@/algorithms/il';

export interface IlMetricsProps {
  testId?: string;
}

export function IlMetrics({ testId = 'il-metrics-panel' }: IlMetricsProps) {
  const version = useLpStore((s) => s.version);
  const priceRatio = useLpStore((s) => s.priceRatio);
  const concentration = useLpStore((s) => s.concentration);
  const fee = useLpStore((s) => s.fee);
  const depositUsd = useLpStore((s) => s.depositUsd);

  const { ilPct, netPnl, aprPct, feeIncome } = useMemo(() => {
    const v3Amp = version === 'v3' ? 1 / Math.max(0.1, 1 - Math.abs(concentration)) : 1;
    const il = calculateV2IL(priceRatio) * v3Amp;
    const netPnlVal = il * depositUsd;
    const apr = fee * (depositUsd / 1000);
    const feeVal = (fee / 100) * depositUsd;
    return {
      ilPct: il * 100,
      netPnl: netPnlVal,
      aprPct: apr,
      feeIncome: feeVal,
    };
  }, [version, priceRatio, concentration, fee, depositUsd]);

  return (
    <div className="dtm-il-metrics" data-testid={testId}>
      <div className="dtm-il-metrics-title">📈 关键指标</div>
      <MetricGrid columns={4}>
        <MetricBox
          testId="il-metric-il"
          label="IL %"
          value={`${ilPct >= 0 ? '+' : ''}${ilPct.toFixed(2)}%`}
          trend={ilPct < -0.01 ? 'down' : ilPct > 0.01 ? 'up' : 'flat'}
        />
        <MetricBox
          testId="il-metric-net-pnl"
          label="净 PnL"
          value={`${netPnl >= 0 ? '+$' : '-$'}${Math.abs(Math.round(netPnl)).toLocaleString()}`}
          trend={netPnl >= 0 ? 'up' : 'down'}
        />
        <MetricBox
          testId="il-metric-apr"
          label="APR"
          value={`${aprPct.toFixed(2)}%`}
          trend="flat"
        />
        <MetricBox
          testId="il-metric-fee"
          label="手续费收入"
          value={`$${Math.round(feeIncome).toLocaleString()}`}
          trend="up"
        />
      </MetricGrid>
    </div>
  );
}

export default IlMetrics;
