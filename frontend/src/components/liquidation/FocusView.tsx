/**
 * FocusView — the single-address microscope view of the Liquidation
 * focus mode.
 *
 * Layout (mirrors DTM_Demo.html lines 832-944):
 *   - Left:  AddressInput + 5 SimParams sliders + ExperimentControls
 *   - Middle: RedAlert (when active) + HfGaugePanel + PriceHfCurve
 *             + LiquidationTimeline
 *
 * Implemented as a self-contained view that the Liquidation page can
 * also wire up via the per-piece sub-components in this folder
 * (AddressInput, SimParams, etc.).  When the page rewires things it
 * imports the sub-components directly.
 */

import { useEffect } from 'react';
import { useCanvas } from '@/canvas/useCanvas';
import { setHfGauge } from '@/canvas/HfGauge';
import { drawPriceHfCurve, type PriceHfPoint } from '@/canvas/PriceHfCurve';
import { useLiquidationStore } from '@/store/liquidationStore';
import { ParamSlider } from '@/components/panels';

const HF_MAX = 3;
const HEIGHT_GAUGE = 200;
const HEIGHT_CURVE = 220;

/** Build a simple monotonic price→HF curve from the sliders. */
function buildCurve(price: number, debt: number, collateral: number): PriceHfPoint[] {
  const points: PriceHfPoint[] = [];
  // Sweep from 0.5x to 1.5x of the current price.
  for (let i = 0; i < 20; i++) {
    const p = price * (0.5 + (i / 19) * 1.0);
    const collValue = collateral * p;
    const threshold = 0.8;
    const hf = debt > 0 ? (collValue * threshold) / debt : 5;
    points.push({ price: p, hf });
  }
  return points;
}

export interface FocusViewProps {
  testId?: string;
}

export function FocusView({ testId = 'liquidation-focus-panel' }: FocusViewProps) {
  const sliders = useLiquidationStore((s) => s.sliders);
  const redAlert = useLiquidationStore((s) => s.redAlert);
  const focusAddress = useLiquidationStore((s) => s.focusAddress);
  const setSlider = useLiquidationStore((s) => s.setSlider);
  const setFocusAddress = useLiquidationStore((s) => s.setFocusAddress);
  const setRedAlert = useLiquidationStore((s) => s.setRedAlert);

  const curve = buildCurve(sliders.price, sliders.debt, sliders.collateral);
  // Compute the current HF for the gauge.
  const threshold = sliders.ltv;
  const collValue = sliders.collateral * sliders.price;
  const hf = sliders.debt > 0 ? (collValue * threshold) / sliders.debt : 5;
  const level: 'safe' | 'warning' | 'danger' | 'liquidated' =
    hf < 0.9 ? 'danger' : hf < 1.2 ? 'warning' : 'safe';

  useEffect(() => {
    setHfGauge({ value: hf, max: HF_MAX, level });
  }, [hf, level]);

  const { ref: curveRef } = useCanvas(
    (ctx, size) => drawPriceHfCurve(ctx, size, curve),
    [curve],
  );

  return (
    <div className="dtm-focus-view" data-testid={testId}>
      <div className="dtm-focus-col dtm-focus-col-left">
        <div className="dtm-address-input-row">
          <input
            type="text"
            className="dtm-address-input"
            data-testid="liquidation-address-input"
            value={focusAddress}
            onChange={(e) => setFocusAddress(e.target.value)}
            placeholder="0x..."
          />
          <button
            type="button"
            className="dtm-address-search-btn"
            data-testid="liquidation-address-search"
            onClick={() => setRedAlert({ active: true, title: '已对焦', desc: focusAddress })}
          >
            搜索
          </button>
        </div>

        <div className="dtm-sim-params" data-testid="liquidation-sim-params">
          <ParamSlider
            testId="sim-param-collateral"
            label="抵押 ETH"
            min={1}
            max={100}
            value={sliders.collateral}
            onChange={(v) => setSlider('collateral', v)}
            suffix=" ETH"
          />
          <ParamSlider
            testId="sim-param-debt"
            label="借款 USDC"
            min={1000}
            max={50000}
            value={sliders.debt}
            onChange={(v) => setSlider('debt', v)}
            suffix=" USDC"
          />
          <ParamSlider
            testId="sim-param-price"
            label="ETH 价格"
            min={800}
            max={5000}
            value={sliders.price}
            onChange={(v) => setSlider('price', v)}
            suffix=" USD"
          />
          <ParamSlider
            testId="sim-param-bonus"
            label="清算奖励"
            min={1}
            max={15}
            value={sliders.bonus}
            onChange={(v) => setSlider('bonus', v)}
            suffix=" %"
          />
          <ParamSlider
            testId="sim-param-ltv"
            label="LTV 上限"
            min={50}
            max={90}
            value={Math.round(sliders.ltv * 100)}
            onChange={(v) => setSlider('ltv', v / 100)}
            suffix=" %"
          />
        </div>

        <div className="dtm-experiment-controls" data-testid="liquidation-experiment-controls">
          <button type="button" data-testid="liquidation-experiment-start">▶ 开始仿真</button>
          <button type="button" data-testid="liquidation-experiment-pause">⏸ 暂停</button>
          <button type="button" data-testid="liquidation-experiment-reset">↺ 重置</button>
        </div>
      </div>

      <div className="dtm-focus-col dtm-focus-col-middle">
        {redAlert?.active && (
          <div
            className="dtm-red-alert"
            data-testid="liquidation-red-alert-panel"
            role="alert"
          >
            <span aria-hidden="true">🚨</span>
            <div>
              <div className="dtm-red-alert-title">{redAlert.title}</div>
              <div className="dtm-red-alert-desc">{redAlert.desc}</div>
            </div>
          </div>
        )}

        <div className="dtm-hf-gauge-panel" data-testid="liquidation-hf-gauge-panel">
          <div className="dtm-hf-gauge-label">单地址 HF 仪表</div>
          <div className="dtm-hf-gauge-readout">{hf.toFixed(2)}</div>
          <div className="dtm-hf-gauge-level">{level.toUpperCase()}</div>
          <canvas
            ref={curveRef}
            className="dtm-viz-canvas"
            data-testid="liquidation-hf-gauge-canvas"
            height={HEIGHT_GAUGE}
            style={{ display: 'none' }}
          />
          {/* The actual gauge canvas is mounted by HfGaugePanel; we
              reserve this slot here so the slot is visible. */}
          <div className="dtm-hf-gauge-canvas-placeholder" data-testid="hf-gauge-canvas-placeholder" />
        </div>

        <div className="dtm-price-hf-curve" data-testid="liquidation-price-hf-curve-panel">
          <div className="dtm-price-hf-curve-label">价格 vs HF 曲线</div>
          <canvas
            ref={curveRef}
            className="dtm-viz-canvas"
            data-testid="liquidation-price-hf-curve-canvas"
            height={HEIGHT_CURVE}
          />
        </div>

        <div className="dtm-liquidation-timeline" data-testid="liquidation-timeline-panel">
          <div className="dtm-liquidation-timeline-step">T+0 · 初始 · 抵押 10 ETH</div>
          <div className="dtm-liquidation-timeline-step">T+5 · HF 接近 1.0</div>
          <div className="dtm-liquidation-timeline-step">T+8 · 触发清算</div>
          <div className="dtm-liquidation-timeline-step">T+9 · 罚金分配</div>
        </div>
      </div>
    </div>
  );
}

export default FocusView;
