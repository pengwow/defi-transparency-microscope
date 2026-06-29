/**
 * QuantResults — the "量化结果" panel on the Fork tab.
 *
 * Renders a single RiskGauge for attacker profit / pool depth (a
 * normalised 0-100 score) plus a 2x2 MetricGrid of (slippage, profit,
 * cost, ROI) values.  All values are derived from the
 * `forkStore.result` slice, so they update in real time as the user
 * moves a slider or clicks "重放仿真".
 */

import { MetricGrid, MetricBox, RiskGauge } from '@/components/panels';
import { useForkStore } from '@/store/forkStore';

export interface QuantResultsValues {
  /** Attacker profit in USD. */
  profit: number;
  /** Pool depth in WETH. */
  poolDepth: number;
  /** Slippage suffered by the victim, in percent. */
  slippagePct: number;
  /** Cost to the attacker in USD (gas + tip). */
  costUsd: number;
}

export interface QuantResultsProps {
  /** Optional override values (used by tests). */
  values?: QuantResultsValues;
  testId?: string;
}

export function QuantResults({ values, testId = 'quant-results' }: QuantResultsProps) {
  const result = useForkStore((s) => s.result);
  const params = useForkStore((s) => s.params);

  const v: QuantResultsValues = values ?? {
    profit: result.profitUsd,
    poolDepth: params.poolDepth,
    slippagePct: result.slippagePct,
    costUsd: result.costUsd,
  };

  // Normalise the gauge value: 0 profit → 0; profit >= pool-depth*2 → 100.
  const max = Math.max(1, v.poolDepth * 2);
  const gaugeValue = Math.round(Math.max(0, Math.min(100, (v.profit / max) * 100)));
  const level = gaugeValue >= 70 ? 'high' : gaugeValue >= 30 ? 'medium' : 'low';
  const roi = v.costUsd > 0 ? (v.profit / v.costUsd) * 100 : 0;

  return (
    <div className="dtm-quant-results" data-testid={testId}>
      <RiskGauge
        value={gaugeValue}
        level={level}
        label="策略方利润 / 池子深度"
        testId="quant-risk-gauge"
      />
      <MetricGrid columns={2}>
        <MetricBox
          label="滑点"
          value={`${v.slippagePct.toFixed(1)}%`}
          testId="quant-metric-slippage"
        />
        <MetricBox
          label="利润"
          value={`$${v.profit.toLocaleString()}`}
          testId="quant-metric-profit"
        />
        <MetricBox
          label="成本"
          value={`$${v.costUsd.toLocaleString()}`}
          testId="quant-metric-cost"
        />
        <MetricBox label="ROI" value={`${roi.toFixed(0)}%`} testId="quant-metric-roi" />
      </MetricGrid>
    </div>
  );
}
