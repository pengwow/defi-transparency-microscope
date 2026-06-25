/**
 * LiveAmmPanel — hosts the real-time AMM line chart plus a floating
 * price ticker that displays the current price and the change
 * since the previous tick.
 *
 * The canvas is driven by the `useCanvas` hook which calls
 * `drawLiveAmm` every frame; the hook ticks the price via
 * `updatePrice` on each rAF to keep the chart in motion.
 */

import { useEffect, useState } from 'react';
import { useCanvas } from '@/canvas/useCanvas';
import { drawLiveAmm, getLivePrice, updatePrice } from '@/canvas/LiveAmm';

const INITIAL_CHANGE = 0;

export function LiveAmmPanel() {
  const { ref } = useCanvas(
    (ctx, size) => {
      // Bump the simulated price a hair so the chart moves each frame.
      updatePrice(0.4);
      drawLiveAmm(ctx, size);
    },
    [],
  );

  const [price, setPrice] = useState<number>(getLivePrice());
  const [change, setChange] = useState<number>(INITIAL_CHANGE);

  useEffect(() => {
    const id = setInterval(() => {
      const next = getLivePrice();
      const delta = ((next - price) / price) * 100;
      setPrice(next);
      setChange(delta);
    }, 800);
    return () => clearInterval(id);
  }, [price]);

  return (
    <div className="dtm-live-amm" data-testid="live-amm">
      <div className="dtm-price-ticker" data-testid="price-ticker">
        <div className="dtm-price-ticker-label">当前价格</div>
        <div className="dtm-price-ticker-value" data-testid="price-ticker-value">
          {price.toFixed(2)}
        </div>
        <div
          className="dtm-price-ticker-change"
          data-testid="live-amm-change"
          style={{ color: change >= 0 ? 'var(--dtm-lime)' : 'var(--dtm-coral)' }}
        >
          {change >= 0 ? '+' : ''}
          {change.toFixed(2)}% {change >= 0 ? '▲' : '▼'}
        </div>
      </div>
      <canvas
        ref={ref}
        className="dtm-viz-canvas"
        data-testid="live-amm-canvas"
        height={300}
      />
    </div>
  );
}
