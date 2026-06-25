/**
 * HfGaugePanel — the "单地址 HF 仪表" panel.
 *
 * Hosts the HfGauge canvas and an HTML readout (numeric value +
 * safe / warning / danger / liquidated status).
 *
 * The HF is derived from the `liquidationStore.sliders` slice (price
 * × collateral × LTV ÷ debt).
 */

import { useEffect } from 'react';
import { useCanvas } from '@/canvas/useCanvas';
import { drawHfGauge, setHfGauge, type HfLevel } from '@/canvas/HfGauge';
import { useLiquidationStore } from '@/store/liquidationStore';

const HF_MAX = 3;
const HEIGHT = 200;

function deriveLevel(hf: number): HfLevel {
  if (hf < 0.01) return 'liquidated';
  if (hf < 0.95) return 'danger';
  if (hf < 1.2) return 'warning';
  return 'safe';
}

export interface HfGaugePanelProps {
  testId?: string;
}

export function HfGaugePanel({
  testId = 'liquidation-hf-gauge-panel',
}: HfGaugePanelProps) {
  const sliders = useLiquidationStore((s) => s.sliders);

  const collValue = sliders.collateral * sliders.price;
  const hf = sliders.debt > 0 ? (collValue * sliders.ltv) / sliders.debt : 5;
  const level = deriveLevel(hf);

  useEffect(() => {
    setHfGauge({ value: hf, max: HF_MAX, level });
  }, [hf, level]);

  const { ref } = useCanvas(
    (ctx, size) => drawHfGauge(ctx, size, {}),
    [hf, level],
  );

  const valueColor: Record<HfLevel, string> = {
    safe: '#69f0ae',
    warning: '#ffab40',
    danger: '#ff5e5e',
    liquidated: '#5a6a82',
  };

  return (
    <div className="dtm-hf-gauge-panel" data-testid={testId}>
      <div className="dtm-hf-gauge-panel-title">📊 单地址 HF 仪表</div>
      <div
        className="dtm-hf-gauge-panel-value"
        data-testid="hf-gauge-panel-value"
        style={{ color: valueColor[level] }}
      >
        {hf.toFixed(2)}
      </div>
      <div
        className="dtm-hf-gauge-panel-level"
        data-testid="hf-gauge-panel-level"
        style={{ color: valueColor[level] }}
      >
        {level.toUpperCase()}
      </div>
      <canvas
        ref={ref}
        className="dtm-viz-canvas"
        data-testid="hf-gauge-panel-canvas"
        height={HEIGHT}
      />
    </div>
  );
}

export default HfGaugePanel;
