/**
 * LpScenarios — 4 preset scenario cards that flip
 * `lpStore.priceRatio` to 2 / 0.5 / 1 / 5.
 *
 *   📈 ETH 涨 2x        → 2
 *   📉 ETH 跌 50%       → 0.5
 *   🔄 横盘 0.5-1.5     → 1
 *   💥 极端 5x          → 5
 */

import { ExperimentCard } from '@/components/panels';
import { useLpStore } from '@/store/lpStore';

export interface LpScenariosProps {
  testId?: string;
}

const SCENARIOS: Array<{
  testId: string;
  icon: string;
  title: string;
  desc: string;
  ratio: number;
}> = [
  { testId: 'lpil-scenario-up-2x', icon: '📈', title: 'ETH 涨 2x', desc: '从 1.0x → 2.0x', ratio: 2 },
  { testId: 'lpil-scenario-down-50', icon: '📉', title: 'ETH 跌 50%', desc: '从 1.0x → 0.5x', ratio: 0.5 },
  { testId: 'lpil-scenario-flat', icon: '🔄', title: '横盘 0.5-1.5', desc: '价格比 = 1.0x', ratio: 1 },
  { testId: 'lpil-scenario-extreme-5x', icon: '💥', title: '极端 5x', desc: '从 1.0x → 5.0x', ratio: 5 },
];

export function LpScenarios({ testId = 'lpil-scenarios-panel' }: LpScenariosProps) {
  const setPriceRatio = useLpStore((s) => s.setPriceRatio);

  return (
    <div className="dtm-lp-scenarios" data-testid={testId}>
      <div className="dtm-lp-scenarios-title">⚡ 快速场景</div>
      <div className="dtm-lp-scenarios-grid">
        {SCENARIOS.map((s) => (
          <ExperimentCard
            key={s.testId}
            testId={s.testId}
            icon={s.icon}
            title={s.title}
            description={s.desc}
            onClick={() => setPriceRatio(s.ratio)}
          />
        ))}
      </div>
    </div>
  );
}

export default LpScenarios;
