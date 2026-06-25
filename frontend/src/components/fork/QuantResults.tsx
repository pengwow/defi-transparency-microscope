/**
 * QuantResults — the "量化结果" panel on the Fork tab.
 *
 * Renders a single RiskGauge for attacker profit / pool depth (a
 * normalised 0-100 score) plus a 2x2 MetricGrid of (slippage, profit,
 * cost, ROI) values.  All values are derived from the demo scenario
 * in DTM_Demo.html lines 645-664.
 */

import { MetricGrid, MetricBox, RiskGauge } from '@/components/panels';

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

const DEFAULTS: QuantResultsValues = {
  profit: 1240,
  poolDepth: 1000,
  slippagePct: 2.4,
  costUsd: 185,
};

export interface QuantResultsProps {
  values?: QuantResultsValues;
  testId?: string;
}

export function QuantResults({ values = DEFAULTS, testId = 'quant-results' }: QuantResultsProps) {
  // Normalise the gauge value: 0 profit → 0; profit >= pool-depth*2 → 100.
  const max = Math.max(1, values.poolDepth * 2);
  const gaugeValue = Math.round(Math.max(0, Math.min(100, (values.profit / max) * 100)));
  const level = gaugeValue >= 70 ? 'high' : gaugeValue >= 30 ? 'medium' : 'low';
  const roi = values.costUsd > 0 ? (values.profit / values.costUsd) * 100 : 0;

  return (
    <div className="dtm-quant-results" data-testid={testId}>
      <RiskGauge
        value={gaugeValue}
        level={level}
        label="策略方利润 / 池子深度"
        testId="quant-risk-gauge"
      />
      <MetricGrid columns={2}>
        <MetricBox label="滑点" value={`${values.slippagePct.toFixed(1)}%`} testId="quant-metric-slippage" />
        <MetricBox label="利润" value={`$${values.profit.toLocaleString()}`} testId="quant-metric-profit" />
        <MetricBox label="成本" value={`$${values.costUsd.toLocaleString()}`} testId="quant-metric-cost" />
        <MetricBox label="ROI" value={`${roi.toFixed(0)}%`} testId="quant-metric-roi" />
      </MetricGrid>
    </div>
  );
}
