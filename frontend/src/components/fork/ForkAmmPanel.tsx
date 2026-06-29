/**
 * ForkAmmPanel — hosts the ForkAmm canvas plus a "x*y=k 恒积" caption
 * and a live (x, y) readout of the current state.
 *
 * The chart state (reserves + pre/victim/post markers) is sourced
 * from the `forkStore`.  The store's `replaySeq` is used as a
 * dependency so the canvas redraws after a "重放仿真" click.
 */

import { useEffect } from 'react';
import { useCanvas } from '@/canvas/useCanvas';
import {
  drawForkAmm,
  setForkAmmState,
} from '@/canvas/ForkAmm';
import { useForkStore } from '@/store/forkStore';

export interface ForkAmmPanelProps {
  testId?: string;
}

export function ForkAmmPanel({ testId }: ForkAmmPanelProps) {
  const result = useForkStore((s) => s.result);
  const replaySeq = useForkStore((s) => s.replaySeq);

  useEffect(() => {
    setForkAmmState({
      reserve0: result.reserve0,
      reserve1: result.reserve1,
      depth: result.reserve0,
      pre: result.pre,
      victim: result.victim,
      post: result.post,
    });
  }, [result, replaySeq]);

  const { ref } = useCanvas((ctx, size) => {
    drawForkAmm(ctx, size);
  }, [result, replaySeq]);

  return (
    <div className="dtm-fork-amm-panel" data-testid={testId}>
      <div className="dtm-fork-amm-header">
        <span className="dtm-fork-amm-label">x*y=k 恒积</span>
        <span
          className="dtm-fork-amm-readout"
          data-testid="fork-amm-readout"
          data-replay-seq={replaySeq}
        >
          ({result.reserve0.toLocaleString()}, {result.reserve1.toLocaleString()})
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
