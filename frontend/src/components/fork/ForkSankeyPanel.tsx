/**
 * ForkSankeyPanel — hosts the ForkSankey canvas plus 4 target labels
 * and proportional value chips showing the share of each recipient.
 */

import { useCanvas } from '@/canvas/useCanvas';
import { drawForkSankey, type ForkSankeyFlow } from '@/canvas/ForkSankey';

export interface ForkSankeyPanelProps {
  /** Optional flow list.  Defaults to the demo's 4-way split. */
  flows?: ForkSankeyFlow[];
  /** Optional test id. */
  testId?: string;
}

const DEFAULT_FLOWS: ForkSankeyFlow[] = [
  { from: 'LP Pool', to: '策略方', amount: 1240, color: '#ff6b6b' },
  { from: 'LP Pool', to: '交易发起方', amount: 456, color: '#ffd166' },
  { from: 'LP Pool', to: 'LP 手续费', amount: 28, color: '#5bd17b' },
  { from: 'LP Pool', to: 'Validator', amount: 185, color: '#4f8cff' },
];

export function ForkSankeyPanel({ flows = DEFAULT_FLOWS, testId = 'fork-sankey-panel' }: ForkSankeyPanelProps) {
  const { ref } = useCanvas((ctx, size) => {
    drawForkSankey(ctx, size, flows);
  }, [flows]);

  const total = flows.reduce((s, f) => s + f.amount, 0);

  return (
    <div className="dtm-fork-sankey-panel" data-testid={testId}>
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
            <span className="dtm-fork-sankey-amount">
              ${f.amount.toLocaleString()} ({((f.amount / total) * 100).toFixed(1)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
