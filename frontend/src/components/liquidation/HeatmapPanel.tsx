/**
 * HeatmapPanel — the "全链清算归因热力图" panel.
 *
 * Wraps the LiquidationHeatmap canvas in a titled container.  The
 * actual risk data comes from the `liquidationStore` (seeded once on
 * first mount by PanoramaView).
 */

import { useEffect } from 'react';
import { useCanvas } from '@/canvas/useCanvas';
import {
  drawLiquidationHeatmap,
  type LiquidationCell,
} from '@/canvas/LiquidationHeatmap';
import { useLiquidationStore } from '@/store/liquidationStore';

const HEIGHT = 280;

/** Build a 12x8 sparse heatmap with a few "hot" cells. */
function buildDemoCells(): LiquidationCell[] {
  const cells: LiquidationCell[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 12; c++) {
      const base = Math.random();
      const skew = c > 8 ? 0.5 : 0;
      cells.push({ row: r, col: c, value: base * 0.5 + skew });
    }
  }
  return cells;
}

export interface HeatmapPanelProps {
  testId?: string;
}

export function HeatmapPanel({ testId = 'liquidation-heatmap-panel' }: HeatmapPanelProps) {
  const heatmaps = useLiquidationStore((s) => s.heatmaps);
  const setHeatmaps = useLiquidationStore((s) => s.setHeatmaps);

  useEffect(() => {
    if (heatmaps.length === 0) {
      setHeatmaps(buildDemoCells());
    }
  }, [heatmaps.length, setHeatmaps]);

  const { ref } = useCanvas(
    (ctx, size) => {
      drawLiquidationHeatmap(ctx, size, heatmaps.length > 0 ? heatmaps : buildDemoCells());
    },
    [heatmaps],
  );

  return (
    <div className="dtm-heatmap-panel" data-testid={testId}>
      <div className="dtm-heatmap-panel-title">📊 风险热力图</div>
      <canvas
        ref={ref}
        className="dtm-viz-canvas"
        data-testid="heatmap-panel-canvas"
        height={HEIGHT}
      />
    </div>
  );
}

export default HeatmapPanel;
