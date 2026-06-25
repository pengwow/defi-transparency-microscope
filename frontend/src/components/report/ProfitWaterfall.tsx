/**
 * ProfitWaterfall — 6-step profit waterfall chart for the Report tab.
 *
 * Visual: a waterfall chart (drawn on canvas) with 6 step labels
 * listed below for accessibility.
 */

import { useCanvas } from '@/canvas/useCanvas';
import { drawReportWaterfall, type ReportWaterfallStep } from '@/canvas/ReportWaterfall';

export interface ProfitWaterfallProps {
  steps: ReadonlyArray<ReportWaterfallStep>;
  testId?: string;
}

export function ProfitWaterfall({ steps, testId = 'profit-waterfall-panel' }: ProfitWaterfallProps) {
  const { ref } = useCanvas((ctx, size) => drawReportWaterfall(ctx, size, steps), [steps]);

  return (
    <div className="dtm-report-profit-waterfall" data-testid={testId}>
      <canvas
        ref={ref}
        className="dtm-report-profit-waterfall-canvas"
        data-testid="profit-waterfall-canvas"
      />
      <ul className="dtm-report-profit-waterfall-labels" data-testid="profit-waterfall-labels">
        {steps.map((s, i) => (
          <li
            key={s.label}
            className={`dtm-report-profit-waterfall-label dtm-report-profit-waterfall-label-${s.type}`}
            data-testid={`profit-waterfall-label-${i + 1}`}
          >
            {s.label}: {s.delta > 0 ? '+' : ''}{s.delta}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ProfitWaterfall;
