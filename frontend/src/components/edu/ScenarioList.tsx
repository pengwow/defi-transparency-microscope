/**
 * ScenarioList — 5 MEV scenario cards laid out horizontally on the
 * Education tab.
 *
 *   🥪 三明治 (sandwich)
 *   🎯 JIT    (jit)
 *   ⚡ 套利   (arbitrage)
 *   💥 清算   (liquidation)
 *   🐢 前跑   (front-running)
 *
 * The active card (driven by `eduStore.activeScenario`) shows the
 * `is-active` class with a cyan border.  Clicking a card calls
 * `useEduStore.setActiveScenario(scenario)`.
 */

import { ExperimentCard } from '@/components/panels';
import { useEduStore, type EduScenario } from '@/store/eduStore';

export interface ScenarioListProps {
  testId?: string;
}

interface Scenario {
  id: EduScenario;
  testId: string;
  icon: string;
  title: string;
  desc: string;
}

const SCENARIOS: Scenario[] = [
  { id: 'sandwich', testId: 'edu-scenario-sandwich', icon: '🥪', title: '三明治', desc: 'Front-run → Swap → Back-run' },
  { id: 'jit', testId: 'edu-scenario-jit', icon: '🎯', title: 'JIT', desc: '瞬间注入流动性' },
  { id: 'arbitrage', testId: 'edu-scenario-arbitrage', icon: '⚡', title: '套利', desc: 'CEX-DEX 价差套利' },
  { id: 'liquidation', testId: 'edu-scenario-liquidation', icon: '💥', title: '清算', desc: '健康因子 < 1.0' },
  { id: 'front-running', testId: 'edu-scenario-front-running', icon: '🐢', title: '前跑', desc: '抢跑套利' },
];

export function ScenarioList({
  testId = 'edu-scenario-list-panel',
}: ScenarioListProps) {
  const activeScenario = useEduStore((s) => s.activeScenario);
  const setActiveScenario = useEduStore((s) => s.setActiveScenario);

  return (
    <div className="dtm-edu-scenario-list" data-testid={testId}>
      <div className="dtm-edu-scenario-list-title">🔬 MEV 教学场景</div>
      <div className="dtm-edu-scenario-list-grid">
        {SCENARIOS.map((s) => (
          <ExperimentCard
            key={s.id}
            testId={s.testId}
            icon={s.icon}
            title={s.title}
            description={s.desc}
            active={activeScenario === s.id}
            onClick={() => setActiveScenario(s.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default ScenarioList;
