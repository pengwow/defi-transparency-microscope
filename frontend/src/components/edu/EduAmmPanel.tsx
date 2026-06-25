/**
 * EduAmmPanel — hosts the EduAmm canvas with a "演示 AMM 路径" label
 * and live readouts (reserves + slippage) derived from the eduStore.
 *
 * The reserves are derived from the `liquidity` slider (default 1000,
 * max 10000) treated as a USDC notional split 50/50 against an
 * initial $2,500 WETH price — same constants used by the demo.
 * The slippage is the demo's heuristic: ratio = swapSize / liquidity
 * scaled to a percentage.
 */

import { useMemo } from 'react';
import { useCanvas } from '@/canvas/useCanvas';
import { drawEduAmm, setEduAmm } from '@/canvas/EduAmm';
import { useEduStore } from '@/store/eduStore';

const HEIGHT = 240;
const INITIAL_PRICE = 2500;

export interface EduAmmPanelProps {
  testId?: string;
}

export function EduAmmPanel({ testId = 'edu-amm-panel' }: EduAmmPanelProps) {
  const swapSize = useEduStore((s) => s.sliders.swapSize);
  const liquidity = useEduStore((s) => s.sliders.liquidity);

  const { reserve0, reserve1, slippagePct, profitUsd, lossUsd } = useMemo(() => {
    const safeLiq = Math.max(1, liquidity);
    const r0 = safeLiq / INITIAL_PRICE;
    const r1 = safeLiq;
    const ratio = swapSize / safeLiq;
    const slip = ratio * 100 * 2.5;
    const profit = Math.round(swapSize * INITIAL_PRICE * ratio * 0.5);
    const loss = Math.round(swapSize * INITIAL_PRICE * ratio * 0.18);
    return {
      reserve0: r0,
      reserve1: r1,
      slippagePct: slip,
      profitUsd: profit,
      lossUsd: loss,
    };
  }, [swapSize, liquidity]);

  const { ref } = useCanvas(
    (ctx, size) => {
      setEduAmm({ reserve0, reserve1, swapSize });
      drawEduAmm(ctx, size, { reserve0, reserve1, swapSize });
    },
    [reserve0, reserve1, swapSize],
  );

  return (
    <div className="dtm-edu-amm-panel" data-testid={testId}>
      <div className="dtm-edu-amm-panel-title">📊 演示 AMM 路径</div>
      <canvas
        ref={ref}
        className="dtm-canvas dtm-canvas-edu-amm"
        data-testid="edu-amm-canvas"
        height={HEIGHT}
      />
      <div className="dtm-edu-amm-panel-stats">
        <span
          className="dtm-edu-amm-panel-stat"
          data-testid="edu-amm-reserves"
        >
          Reserves {reserve0.toFixed(2)} WETH / {Math.round(reserve1).toLocaleString()} USDC
        </span>
        <span
          className="dtm-edu-amm-panel-stat dtm-edu-amm-panel-slippage"
          data-testid="edu-amm-slippage"
        >
          滑点 {slippagePct.toFixed(1)}%
        </span>
        <span
          className="dtm-edu-amm-panel-stat"
          data-testid="edu-amm-profit"
        >
          策略收益 ${profitUsd.toLocaleString()}
        </span>
        <span
          className="dtm-edu-amm-panel-stat"
          data-testid="edu-amm-loss"
        >
          受害者损失 ${lossUsd.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

export default EduAmmPanel;
