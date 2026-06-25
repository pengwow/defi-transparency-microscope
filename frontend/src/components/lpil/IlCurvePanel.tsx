/**
 * IlCurvePanel — the "📊 IL 机理曲线" panel for the LP/IL tab.
 *
 * Reuses the existing `ILCurve` canvas (with a synthetic V2/V3
 * `Position` so the renderer can pick the right X range and draw
 * both curves).  A small footer shows the current price-ratio
 * marker and a V2/V3 pill (driven by the `lpStore`).
 */

import { useMemo } from 'react';
import { useCanvas } from '@/canvas/useCanvas';
import { draw as drawILCurve } from '@/canvas/ILCurve';
import { useLpStore } from '@/store/lpStore';
import type { V2Position, V3Position } from '@/types';

const HEIGHT = 260;

/** Build a synthetic V2 position for the ILCurve renderer. */
function buildV2Position(_ratio: number): V2Position {
  return {
    id: 'lp-v2-synth',
    owner: '0xsynth',
    poolAddress: '0xpool',
    protocol: 'uniswap_v2',
    status: 'active',
    openedAt: 0,
    liquidity: 1_000_000n,
    amount0: 1_000_000n,
    amount1: 1_000_000n,
  };
}

/** Build a synthetic V3 position with a ±50% range around the current ratio. */
function buildV3Position(_ratio: number): V3Position {
  const tickLower = -887272; // -50% in sqrt(1.0001)
  const tickUpper = 887272;  // +50% in sqrt(1.0001)
  return {
    id: 'lp-v3-synth',
    owner: '0xsynth',
    poolAddress: '0xpool',
    protocol: 'uniswap_v3',
    status: 'active',
    openedAt: 0,
    tickLower,
    tickUpper,
    liquidity: 1_000_000n,
    amount0: 1_000_000n,
    amount1: 1_000_000n,
    tokensOwed0: 0n,
    tokensOwed1: 0n,
  };
}

export interface IlCurvePanelProps {
  testId?: string;
}

export function IlCurvePanel({ testId = 'il-curve-panel' }: IlCurvePanelProps) {
  const priceRatio = useLpStore((s) => s.priceRatio);
  const version = useLpStore((s) => s.version);

  const position = useMemo(
    () => (version === 'v3' ? buildV3Position(priceRatio) : buildV2Position(priceRatio)),
    [version, priceRatio],
  );

  const { ref } = useCanvas(
    (ctx, size) => {
      drawILCurve(ctx, size, { position });
    },
    [position],
  );

  return (
    <div className="dtm-il-curve-panel" data-testid={testId}>
      <div className="dtm-il-curve-panel-title">📊 IL 机理曲线</div>
      <canvas
        ref={ref}
        className="dtm-canvas dtm-canvas-il"
        data-testid="il-curve-canvas"
        height={HEIGHT}
      />
      <div className="dtm-il-curve-panel-footer">
        <span
          className="dtm-il-curve-version-pill"
          data-testid="il-curve-version-pill"
        >
          {version.toUpperCase()}
        </span>
        <span
          className="dtm-il-curve-current-marker"
          data-testid="il-curve-current-marker"
        >
          当前 r = {priceRatio.toFixed(2)}x
        </span>
      </div>
    </div>
  );
}

export default IlCurvePanel;
