/**
 * RiskRadar — 5-axis risk radar chart for the Report tab.
 *
 * Visual: a pentagon radar (drawn on canvas) with 5 axis labels
 * listed below it for accessibility.
 */

import { useCanvas } from '@/canvas/useCanvas';
import { drawReportRadar, type ReportRadarAxis } from '@/canvas/ReportRadar';

export interface RiskRadarProps {
  axes: ReadonlyArray<ReportRadarAxis>;
  testId?: string;
}

export function RiskRadar({ axes, testId = 'risk-radar-panel' }: RiskRadarProps) {
  const { ref } = useCanvas((ctx, size) => drawReportRadar(ctx, size, axes), [axes]);

  return (
    <div className="dtm-report-risk-radar" data-testid={testId}>
      <canvas
        ref={ref}
        className="dtm-report-risk-radar-canvas"
        data-testid="risk-radar-canvas"
      />
      <ul className="dtm-report-risk-radar-labels" data-testid="risk-radar-labels">
        {axes.map((a, i) => (
          <li
            key={a.label}
            className="dtm-report-risk-radar-label"
            data-testid={`risk-radar-label-${i + 1}`}
          >
            {a.label}: {a.value}/{a.max}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default RiskRadar;
