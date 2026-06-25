/**
 * PanoramaView — the "全链机理广播" left column of the Liquidation
 * panorama mode.
 *
 * Visual layout (mirrors DTM_Demo.html lines 776-820):
 *   ┌───────────────────────────┐
 *   │  12x8 风险热力图 (canvas) │
 *   ├───────────────────────────┤
 *   │  3 个协议 metric box      │
 *   │  Aave V3 | Compound |     │
 *   │  MakerDAO                │
 *   └───────────────────────────┘
 *
 * Renders the `LiquidationHeatmap` canvas plus a simple 12x8 cell
 * legend and three protocol summary metric boxes (counts / 24h
 * volume).  Sub-components (`HeatmapPanel`, `ProtocolStats`,
 * `PendingMempool`) are kept separate so they can be reused; this
 * view is the visual seam.
 */

import { useEffect } from 'react';
import { useCanvas } from '@/canvas/useCanvas';
import {
  drawLiquidationHeatmap,
  type LiquidationCell,
} from '@/canvas/LiquidationHeatmap';
import { useLiquidationStore } from '@/store/liquidationStore';

const HEATMAP_HEIGHT = 240;
const PROTOCOLS: Array<{ key: string; label: string; value: string; color: string }> = [
  { key: 'aave', label: 'Aave V3', value: '47 笔 · $12.4M', color: '#00e5ff' },
  { key: 'compound', label: 'Compound', value: '23 笔 · $4.1M', color: '#ffab40' },
  { key: 'makerdao', label: 'MakerDAO', value: '8 笔 · $1.9M', color: '#b388ff' },
];

/** Build a 12x8 demo heatmap (sparse but realistic). */
function buildDemoCells(): LiquidationCell[] {
  const cells: LiquidationCell[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 12; c++) {
      // Skew a few "hot" cells toward the right side.
      const base = Math.random();
      const skew = c > 8 ? 0.6 : 0;
      cells.push({ row: r, col: c, value: base * 0.5 + skew });
    }
  }
  return cells;
}

export interface PanoramaViewProps {
  testId?: string;
}

export function PanoramaView({ testId = 'liquidation-panorama-panel' }: PanoramaViewProps) {
  const heatmaps = useLiquidationStore((s) => s.heatmaps);
  const setHeatmaps = useLiquidationStore((s) => s.setHeatmaps);

  // Seed demo heatmap cells once.
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
    <div className="dtm-panorama-view" data-testid={testId}>
      <div className="dtm-panorama-heatmap">
        <canvas
          ref={ref}
          className="dtm-viz-canvas"
          data-testid="panorama-heatmap-canvas"
          height={HEATMAP_HEIGHT}
        />
        <div className="dtm-panorama-heatmap-legend" data-testid="panorama-heatmap-legend">
          {Array.from({ length: 8 }).map((_, r) => (
            <span key={r} className="dtm-panorama-heatmap-row-label">
              R{r}
            </span>
          ))}
        </div>
      </div>

      <div className="dtm-panorama-protocols" data-testid="panorama-protocols">
        {PROTOCOLS.map((p) => (
          <div
            key={p.key}
            className="dtm-panorama-protocol"
            data-testid={`panorama-protocol-${p.key === 'makerdao' ? 'makerdao' : p.key}`}
            style={{ borderColor: p.color }}
          >
            <div className="dtm-panorama-protocol-label" style={{ color: p.color }}>
              {p.label}
            </div>
            <div className="dtm-panorama-protocol-value">{p.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PanoramaView;
