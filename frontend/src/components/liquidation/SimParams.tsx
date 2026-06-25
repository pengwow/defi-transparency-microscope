/**
 * SimParams — 5 simulation sliders used to drive the focus-view
 * microscope (collateral / debt / price / bonus / LTV).
 *
 * Reads and writes the `liquidationStore.sliders` slice so the
 * HfGauge and PriceHfCurve can re-derive their outputs when the user
 * drags a slider.
 */

import { ParamSlider } from '@/components/panels';
import { useLiquidationStore } from '@/store/liquidationStore';

export interface SimParamsProps {
  testId?: string;
}

export function SimParams({ testId = 'liquidation-sim-params-panel' }: SimParamsProps) {
  const sliders = useLiquidationStore((s) => s.sliders);
  const setSlider = useLiquidationStore((s) => s.setSlider);

  return (
    <div className="dtm-sim-params" data-testid={testId}>
      <div className="dtm-sim-params-title">🎛️ 仿真参数</div>
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
  );
}

export default SimParams;
