/**
 * ForkConclusion — the "实验结论" panel on the Fork tab.
 *
 * Renders the demo's conclusion paragraph plus a formula block
 * summarising the constant-product price-impact identity:
 *
 *   Δy / Y = Δx / X
 *
 * where a small amount-in Δx (relative to the reserve X) drives a
 * proportional amount-out Δy from the other reserve.  The deeper the
 * pool, the smaller the impact, and the less MEV that can be
 * extracted.
 *
 * The current/alt pool-depth numbers and the actual simulated
 * profit figure are sourced from `forkStore`, so the conclusion
 * updates after every "重放仿真" click.
 */

import { useForkStore } from '@/store/forkStore';

export interface ForkConclusionProps {
  /** Override the current pool depth (WETH). */
  currentDepth?: number;
  /** Override the hypothetical "what if" pool depth (WETH). */
  altDepth?: number;
  testId?: string;
}

export function ForkConclusion({
  currentDepth,
  altDepth,
  testId = 'fork-conclusion',
}: ForkConclusionProps) {
  const params = useForkStore((s) => s.params);
  const result = useForkStore((s) => s.result);

  const cur = currentDepth ?? params.poolDepth;
  const alt = altDepth ?? Math.max(params.poolDepth * 5, 5000);
  // At alt depth, profit ~ scales with 1/depth^2, so a 5x pool
  // drops profit to ~4% of the current.
  const altProfit = Math.max(0, Math.round(result.profitUsd / Math.pow(alt / Math.max(1, cur), 2)));

  return (
    <div className="dtm-fork-conclusion" data-testid={testId}>
      <p>
        当前池子深度 <strong>{cur.toLocaleString()} WETH</strong>，策略方利润{' '}
        <strong style={{ color: 'var(--dtm-coral)' }} data-testid="fork-conclusion-profit">
          ${result.profitUsd.toLocaleString()}
        </strong>
        。
      </p>
      <p>
        试试把池子深度拖到 <strong>{alt.toLocaleString()} WETH</strong>——策略方利润会骤降至约{' '}
        <strong style={{ color: 'var(--dtm-lime)' }}>${altProfit.toLocaleString()}</strong>。
      </p>
      <p>
        这就是<span style={{ color: 'var(--dtm-lime)' }}>「深池子天然抗 MEV」</span>的原理：同样的交易金额，对深池子的价格冲击更小，策略方可提取的价值也更少。
      </p>
      <pre className="dtm-fork-formula" data-testid="fork-conclusion-formula">
        {`Δx / X  =  Δy / Y`}
      </pre>
    </div>
  );
}
