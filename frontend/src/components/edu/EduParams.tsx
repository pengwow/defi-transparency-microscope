/**
 * EduParams — three ParamSliders (Swap 数量 / 池子深度 / Gas 价格)
 * plus a one-line description of the current scenario.
 *
 * State is read from and written to `eduStore`.  The description
 * text is derived from `eduStore.activeScenario` so the panel
 * always reflects what the user picked in the scenario list above.
 */

import { ParamSlider } from '@/components/panels';
import { useEduStore, type EduScenario } from '@/store/eduStore';

export interface EduParamsProps {
  testId?: string;
}

const SCENARIO_BLURB: Record<EduScenario, string> = {
  sandwich: '三明治策略：观察者用更高的 Gas 在你的交易前后各插一笔，吃掉你的滑点。',
  jit: 'JIT 流动性：大额 swap 出现的同一区块内瞬间注入流动性赚手续费。',
  arbitrage: '套利策略：发现 CEX-DEX 价差，在链上对冲吃掉无风险收益。',
  liquidation: '清算：抵押品价值跌破健康因子阈值，任何人都能清算吃奖励。',
  'front-running': '前跑：抢在别人交易之前提交相同方向的单，吃后续的价格波动。',
};

export function EduParams({ testId = 'edu-params-panel' }: EduParamsProps) {
  const activeScenario = useEduStore((s) => s.activeScenario);
  const swapSize = useEduStore((s) => s.sliders.swapSize);
  const liquidity = useEduStore((s) => s.sliders.liquidity);
  const gasPrice = useEduStore((s) => s.sliders.gasPrice);
  const setSlider = useEduStore((s) => s.setSlider);

  return (
    <div className="dtm-edu-params" data-testid={testId}>
      <div className="dtm-edu-params-title">🎛️ 实验参数</div>
      <div
        className="dtm-edu-params-description"
        data-testid="edu-params-description"
      >
        {SCENARIO_BLURB[activeScenario]}
      </div>
      <ParamSlider
        testId="edu-param-swap-size"
        label="Swap 数量"
        min={1}
        max={100}
        step={1}
        value={swapSize}
        onChange={(v) => setSlider('swapSize', v)}
        suffix=" 单位"
      />
      <ParamSlider
        testId="edu-param-liquidity"
        label="池子深度"
        min={100}
        max={10000}
        step={100}
        value={liquidity}
        onChange={(v) => setSlider('liquidity', v)}
        suffix=" USD"
      />
      <ParamSlider
        testId="edu-param-gas-price"
        label="Gas 价格"
        min={1}
        max={500}
        step={1}
        value={gasPrice}
        onChange={(v) => setSlider('gasPrice', v)}
        suffix=" gwei"
      />
    </div>
  );
}

export default EduParams;
