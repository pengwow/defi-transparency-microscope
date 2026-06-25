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
 */

export interface ForkConclusionProps {
  /** Current pool depth (WETH). */
  currentDepth?: number;
  /** Hypothetical "what if" pool depth (WETH). */
  altDepth?: number;
  testId?: string;
}

export function ForkConclusion({
  currentDepth = 1000,
  altDepth = 5000,
  testId = 'fork-conclusion',
}: ForkConclusionProps) {
  return (
    <div className="dtm-fork-conclusion" data-testid={testId}>
      <p>
        当前池子深度 <strong>{currentDepth.toLocaleString()} WETH</strong>，策略方利润{' '}
        <strong style={{ color: 'var(--dtm-coral)' }}>$1,240</strong>。
      </p>
      <p>
        试试把池子深度拖到 <strong>{altDepth.toLocaleString()} WETH</strong>——策略方利润会骤降至约{' '}
        <strong style={{ color: 'var(--dtm-lime)' }}>$248</strong>。
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
