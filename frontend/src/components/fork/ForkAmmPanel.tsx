/**
 * ForkAmmPanel — hosts the ForkAmm canvas plus a "x*y=k 恒积" caption
 * and a live (x, y) readout of the current state.
 *
 * Drives the canvas through the shared `useCanvas` hook so the chart
 * is redrawn every frame; the readout re-renders whenever the
 * underlying state changes.
 */

import { useEffect, useState } from 'react';
import { useCanvas } from '@/canvas/useCanvas';
import {
  drawForkAmm,
  setForkAmmState,
  type ForkAmmState,
} from '@/canvas/ForkAmm';

export interface ForkAmmPanelProps {
  /** Optional initial state. */
  initial?: Partial<ForkAmmState>;
  /** Optional test id. */
  testId?: string;
}

const DEFAULT_STATE: ForkAmmState = {
  reserve0: 1000,
  reserve1: 2_000_000,
  depth: 1000,
  pre: { x: 980, y: 2_040_000 },
  victim: { x: 1000, y: 2_000_000 },
  post: { x: 1020, y: 1_960_000 },
};

export function ForkAmmPanel({ initial, testId }: ForkAmmPanelProps) {
  // Local state; the setter is exposed for future use (live re-simulation
  // is currently driven by the surrounding page, so it stays unused for
  // now — keep the reference so lint stays quiet).
  const [state, setState] = useState<ForkAmmState>(() => ({
    ...DEFAULT_STATE,
    ...initial,
  }));
  void setState;

  useEffect(() => {
    setForkAmmState(state);
  }, [state]);

  const { ref } = useCanvas((ctx, size) => {
    drawForkAmm(ctx, size);
  }, [state]);

  return (
    <div className="dtm-fork-amm-panel" data-testid={testId}>
      <div className="dtm-fork-amm-header">
        <span className="dtm-fork-amm-label">x*y=k 恒积</span>
        <span className="dtm-fork-amm-readout" data-testid="fork-amm-readout">
          ({state.reserve0.toLocaleString()}, {state.reserve1.toLocaleString()})
        </span>
      </div>
      <canvas
        ref={ref}
        className="dtm-viz-canvas"
        data-testid="fork-amm-canvas"
        height={260}
      />
    </div>
  );
}
