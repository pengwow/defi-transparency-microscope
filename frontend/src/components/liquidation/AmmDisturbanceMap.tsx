/**
 * AmmDisturbanceMap — the "AMM 机理扰动图" panel.
 *
 * Hosts the AmmDisturbance canvas (constant-product x*y=k curve with
 * a pulsing red attack marker) and a small caption explaining what
 * the red circle means.
 */

import { useEffect, useState } from 'react';
import { useCanvas } from '@/canvas/useCanvas';
import {
  drawAmmDisturbance,
  setDisturbance,
} from '@/canvas/AmmDisturbance';

const HEIGHT = 200;

export interface AmmDisturbanceMapProps {
  testId?: string;
}

export function AmmDisturbanceMap({
  testId = 'liquidation-amm-disturbance-panel',
}: AmmDisturbanceMapProps) {
  const [pulse, setPulse] = useState(0.5);

  useEffect(() => {
    setDisturbance({ reserve0: 1000, reserve1: 2_000_000, attackSize: 200, color: '#ff5e5e' });
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setPulse((p) => (p + 0.1) % 1);
    }, 120);
    return () => clearInterval(id);
  }, []);

  const { ref } = useCanvas(
    (ctx, size) => drawAmmDisturbance(ctx, size, { pulse }),
    [pulse],
  );

  return (
    <div className="dtm-amm-disturbance-map" data-testid={testId}>
      <div className="dtm-amm-disturbance-title">🌀 AMM 机理扰动图</div>
      <canvas
        ref={ref}
        className="dtm-viz-canvas"
        data-testid="amm-disturbance-canvas"
        height={HEIGHT}
      />
      <div className="dtm-amm-disturbance-caption" data-testid="amm-disturbance-caption">
        大 swap 触发红圈脉冲，池子 x*y=k 被扰动
      </div>
    </div>
  );
}

export default AmmDisturbanceMap;
