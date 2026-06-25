/**
 * IlPnlPanel — the "💰 IL-费 归因盈亏" panel for the LP/IL tab.
 *
 * Hosts the IlPnlChart canvas (4 price-ratio scenarios × V2/V3
 * bars) and a small footer with:
 *   - V2 / V3 colour legend
 *   - current V2 PnL big number (positive → green, negative → coral)
 *
 * The scenarios cover a fixed range (0.5x / 1x / 2x / 5x); the
 * V2 and V3 PnL for each are derived from the closed-form V2 IL
 * amplified by the V3 concentration factor.
 */

import { useMemo } from 'react';
import { useCanvas } from '@/canvas/useCanvas';
import { drawIlPnlChart, type IlPnlData } from '@/canvas/IlPnlChart';
import { useLpStore } from '@/store/lpStore';
import { calculateV2IL } from '@/algorithms/il';

const HEIGHT = 220;

const SCENARIO_RATIOS: Array<{ label: string; ratio: number }> = [
  { label: '0.5x', ratio: 0.5 },
  { label: '1x', ratio: 1 },
  { label: '2x', ratio: 2 },
  { label: '5x', ratio: 5 },
];

export interface IlPnlPanelProps {
  testId?: string;
}

export function IlPnlPanel({ testId = 'il-pnl-panel' }: IlPnlPanelProps) {
  const priceRatio = useLpStore((s) => s.priceRatio);
  const concentration = useLpStore((s) => s.concentration);
  const version = useLpStore((s) => s.version);
  const depositUsd = useLpStore((s) => s.depositUsd);

  // Compute V2 / V3 PnL for each scenario.  PnL = IL × depositUsd
  // (so positive values mean the LP gained against HODL, negative
  // means the LP lost).  V3 amplifies by 1 / (1 - |concentration|).
  const data: IlPnlData[] = useMemo(() => {
    const v3Amp = version === 'v3' ? 1 / Math.max(0.1, 1 - Math.abs(concentration)) : 1;
    return SCENARIO_RATIOS.map(({ label, ratio }) => {
      const il = calculateV2IL(ratio);
      return {
        label,
        v2: il * depositUsd,
        v3: il * v3Amp * depositUsd,
      };
    });
  }, [concentration, version, depositUsd]);

  // Current PnL — interpolated for the active price ratio.
  const currentPnl = useMemo(() => {
    const v3Amp = version === 'v3' ? 1 / Math.max(0.1, 1 - Math.abs(concentration)) : 1;
    const il = calculateV2IL(priceRatio);
    return version === 'v3' ? il * v3Amp * depositUsd : il * depositUsd;
  }, [priceRatio, concentration, version, depositUsd]);

  const { ref } = useCanvas(
    (ctx, size) => {
      drawIlPnlChart(ctx, size, data);
    },
    [data],
  );

  return (
    <div className="dtm-il-pnl-panel" data-testid={testId}>
      <div className="dtm-il-pnl-panel-title">💰 IL-费 归因盈亏</div>
      <canvas
        ref={ref}
        className="dtm-canvas dtm-canvas-pnl"
        data-testid="il-pnl-canvas"
        height={HEIGHT}
      />
      <div className="dtm-il-pnl-panel-legend">
        <span
          className="dtm-il-pnl-legend-item"
          data-testid="il-pnl-legend-v2"
        >
          <span
            className="dtm-il-pnl-legend-dot"
            style={{ background: '#ffab40' }}
            aria-hidden="true"
          />
          V2
        </span>
        <span
          className="dtm-il-pnl-legend-item"
          data-testid="il-pnl-legend-v3"
        >
          <span
            className="dtm-il-pnl-legend-dot"
            style={{ background: '#00e5ff' }}
            aria-hidden="true"
          />
          V3
        </span>
      </div>
      <div className="dtm-il-pnl-panel-current">
        <span className="dtm-il-pnl-panel-current-label">
          当前 {version.toUpperCase()} PnL
        </span>
        <span
          className="dtm-il-pnl-panel-current-value"
          data-testid="il-pnl-current"
          style={{ color: currentPnl >= 0 ? '#69f0ae' : '#ff5e5e' }}
        >
          {currentPnl >= 0 ? '+$' : '-$'}
          {Math.abs(Math.round(currentPnl)).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

export default IlPnlPanel;
