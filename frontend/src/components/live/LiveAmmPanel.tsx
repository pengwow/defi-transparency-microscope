/**
 * LiveAmmPanel — hosts the real-time AMM line chart plus a floating
 * price ticker that displays the current price and the change
 * since the previous tick.
 *
 * Data source priority:
 *   1. `liveStore.ammPriceE18` — driven by the `amm_sync` WS topic
 *      from the backend (set in App.tsx).  The chart is driven by
 *      a `useEffect` that pushes each new price via `setLivePrice`,
 *      which dedupes repeated values so a flat market doesn't
 *      pad the rolling window with the same point.
 *   2. If no real price has ever arrived (mock mode, backend down,
 *      or simply quiet market), the rAF loop falls back to a slow
 *      random walk with `updatePrice(0.02)` so the chart isn't
 *      a flat line.
 *
 * The `useCanvas` hook calls `drawLiveAmm` every frame, which
 * paints whatever is currently in the chart's history.
 */

import { useEffect, useState } from 'react';
import { useCanvas } from '@/canvas/useCanvas';
import {
  drawLiveAmm,
  getLivePrice,
  setLivePrice,
  updatePrice,
} from '@/canvas/LiveAmm';
import { useLiveStore } from '@/store/liveStore';

const INITIAL_CHANGE = 0;
// Magnitude of the per-frame random-walk perturbation used as a
// fallback when no real price is flowing.  At ~30 fps this is
// ±0.6 USD/s — close to a quiet ETH/USDC market, far from the
// old ±24 USD/s "demo on caffeine" pace.
const FALLBACK_WALK = 0.02;

export function LiveAmmPanel() {
  const ammPriceE18 = useLiveStore((s) => s.ammPriceE18);
  const backendConnected = useLiveStore((s) => s.backendConnected);

  const { ref } = useCanvas(
    (ctx, size) => {
      // If the store has a real price, `setLivePrice` was already
      // called via the useEffect below, so the history is up to
      // date.  Otherwise nudge it with the slow random walk so
      // the chart looks alive in mock / disconnected mode.
      if (useLiveStore.getState().ammPriceE18 === 0n) {
        updatePrice(FALLBACK_WALK);
      }
      drawLiveAmm(ctx, size);
    },
    [],
  );

  // Push real backend prices into the chart history.  The
  // `setLivePrice` function dedupes, so this is cheap even if
  // the store value changes rapidly.
  useEffect(() => {
    if (ammPriceE18 <= 0n) return;
    // Convert 1e18 fixed-point bigint → float.  Number can lose
    // precision for very large values, but for spot prices in the
    // 1e3..1e6 range this is well within safe-integer territory.
    const price = Number(ammPriceE18) / 1e18;
    setLivePrice(price);
  }, [ammPriceE18]);

  const [price, setPrice] = useState<number>(getLivePrice());
  const [change, setChange] = useState<number>(INITIAL_CHANGE);

  useEffect(() => {
    const id = setInterval(() => {
      const next = getLivePrice();
      const prev = price > 0 ? price : next;
      const delta = ((next - prev) / prev) * 100;
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
        <div
          className={
            'dtm-price-ticker-source ' +
            (backendConnected ? 'is-live' : 'is-demo')
          }
          data-testid="live-amm-source"
          title={
            backendConnected
              ? 'Driven by the backend amm_sync WebSocket'
              : 'Mock mode — no backend connection'
          }
        >
          {backendConnected ? '● Backend: live' : '○ Backend: demo'}
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
