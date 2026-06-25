/**
 * PriceHfCurve (component) — wraps the PriceHfCurve canvas in a
 * titled panel with the "HF=1 警戒线" annotation.
 *
 * The curve is computed from the `liquidationStore.sliders` slice;
 * it sweeps a price range around the current ETH price and plots
 * the resulting HF.
 */

import { useCanvas } from '@/canvas/useCanvas';
import { drawPriceHfCurve, type PriceHfPoint } from '@/canvas/PriceHfCurve';
import { useLiquidationStore } from '@/store/liquidationStore';

const HEIGHT = 220;

function buildCurve(price: number, debt: number, collateral: number): PriceHfPoint[] {
  const points: PriceHfPoint[] = [];
  for (let i = 0; i < 20; i++) {
    const p = price * (0.5 + (i / 19) * 1.0);
    const collValue = collateral * p;
    const threshold = 0.8;
    const hf = debt > 0 ? (collValue * threshold) / debt : 5;
    points.push({ price: p, hf });
  }
  return points;
}

export interface PriceHfCurveProps {
  testId?: string;
}

export function PriceHfCurve({
  testId = 'liquidation-price-hf-curve-panel',
}: PriceHfCurveProps) {
  const sliders = useLiquidationStore((s) => s.sliders);
  const curve = buildCurve(sliders.price, sliders.debt, sliders.collateral);

  const { ref } = useCanvas(
    (ctx, size) => drawPriceHfCurve(ctx, size, curve),
    [curve],
  );

  return (
    <div className="dtm-price-hf-curve" data-testid={testId}>
      <div className="dtm-price-hf-curve-title">📈 价格 vs HF 曲线</div>
      <canvas
        ref={ref}
        className="dtm-viz-canvas"
        data-testid="price-hf-curve-canvas"
        height={HEIGHT}
      />
      <div className="dtm-price-hf-curve-annotation">HF=1 警戒线</div>
    </div>
  );
}

export default PriceHfCurve;
