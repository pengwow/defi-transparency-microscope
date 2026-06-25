/**
 * StrategyPie — 5-segment pie chart of MEV strategy attribution
 * for the Report tab.
 *
 * Visual: a donut chart (drawn on canvas) plus a 5-row legend
 * underneath, each row showing a colored dot, the strategy name,
 * and the percentage share.
 */

import { useCanvas } from '@/canvas/useCanvas';
import { drawReportPie, type ReportPieSlice } from '@/canvas/ReportPie';

export interface StrategyPieProps {
  slices: ReadonlyArray<ReportPieSlice>;
  testId?: string;
}

export function StrategyPie({ slices, testId = 'strategy-pie-panel' }: StrategyPieProps) {
  const { ref } = useCanvas((ctx, size) => drawReportPie(ctx, size, slices), [slices]);

  const total = slices.reduce((acc, s) => acc + Math.max(0, s.value), 0) || 1;

  return (
    <div className="dtm-report-strategy-pie" data-testid={testId}>
      <canvas
        ref={ref}
        className="dtm-report-strategy-pie-canvas"
        data-testid="strategy-pie-canvas"
      />
      <ul className="dtm-report-strategy-pie-legend" data-testid="strategy-pie-legend">
        {slices.map((s, i) => (
          <li
            key={s.label}
            className="dtm-report-strategy-pie-legend-item"
            data-testid={`strategy-pie-legend-${i + 1}`}
          >
            <span
              className="dtm-report-strategy-pie-legend-dot"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            <span className="dtm-report-strategy-pie-legend-label">{s.label}</span>
            <span className="dtm-report-strategy-pie-legend-value">
              {((s.value / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default StrategyPie;
