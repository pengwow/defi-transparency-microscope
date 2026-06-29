/**
 * ForkSankeyPanel — hosts the ForkSankey canvas plus 4 target labels
 * and proportional value chips showing the share of each recipient.
 *
 * The 4 flow amounts (策略方 / 交易发起方 / LP 手续费 / Validator)
 * are sourced from the `forkStore.result.sankey` slice so the chart
 * updates after every "重放仿真" click or slider change.
 */

import { useMemo } from 'react';
import { useCanvas } from '@/canvas/useCanvas';
import { drawForkSankey, type ForkSankeyFlow } from '@/canvas/ForkSankey';
import { useForkStore } from '@/store/forkStore';

export interface ForkSankeyPanelProps {
  testId?: string;
}

export function ForkSankeyPanel({ testId }: ForkSankeyPanelProps) {
  const result = useForkStore((s) => s.result);
  const replaySeq = useForkStore((s) => s.replaySeq);

  const flows: ForkSankeyFlow[] = useMemo(
    () => [
      { from: 'LP Pool', to: '策略方', amount: result.sankey.attacker, color: '#ff6b6b' },
      { from: 'LP Pool', to: '交易发起方', amount: result.sankey.victim, color: '#ffd166' },
      { from: 'LP Pool', to: 'LP 手续费', amount: result.sankey.lpFee, color: '#5bd17b' },
      { from: 'LP Pool', to: 'Validator', amount: result.sankey.validator, color: '#4f8cff' },
    ],
    [result.sankey.attacker, result.sankey.victim, result.sankey.lpFee, result.sankey.validator],
  );

  const { ref } = useCanvas((ctx, size) => {
    drawForkSankey(ctx, size, flows);
  }, [flows, replaySeq]);

  const total = flows.reduce((s, f) => s + f.amount, 0);

  return (
    <div className="dtm-fork-sankey-panel" data-testid={testId ?? 'fork-sankey-panel'}>
      <canvas
        ref={ref}
        className="dtm-viz-canvas"
        data-testid="fork-sankey-canvas"
        height={160}
      />
      <ul className="dtm-fork-sankey-legend">
        {flows.map((f) => (
          <li key={f.to} className="dtm-fork-sankey-legend-item">
            <span className="dtm-fork-sankey-swatch" style={{ background: f.color }} />
            <span className="dtm-fork-sankey-target">{f.to}</span>
            <span className="dtm-fork-sankey-amount" data-replay-seq={replaySeq}>
              ${f.amount.toLocaleString()} (
              {total > 0 ? ((f.amount / total) * 100).toFixed(1) : '0.0'}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
