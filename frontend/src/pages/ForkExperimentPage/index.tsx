/**
 * ForkExperimentPage — the experiment runner view (demo-style 3-col).
 *
 * Mirrors DTM_Demo.html lines 540-677.  Three columns:
 *   1. Controls — param sliders + step pills.
 *   2. Visualisation — ForkAmm + ForkSankey canvases.
 *   3. Results — quantitative gauge + metrics + conclusion.
 *
 * Existing CompareView / ScenarioList exports are preserved as
 * re-exports so external consumers (and any tests) that import them
 * through this module continue to work.
 */

import { useState } from 'react';
import { ExplainBox, Panel } from '@/components/common';
import {
  ForkParams,
  StepControls,
  ForkAmmPanel,
  ForkSankeyPanel,
  ForkTimeline,
  QuantResults,
  ForkConclusion,
  type ForkParamsValues,
} from '@/components/fork';
import { CompareView } from './CompareView';
import { ScenarioList } from './ScenarioList';
import './ForkExperimentPage.css';

// Re-export sibling modules so that callers importing them through
// `pages/ForkExperimentPage` continue to find them after the rewrite.
export { CompareView } from './CompareView';
export { ScenarioList } from './ScenarioList';

const STEP_DESCRIPTIONS = [
  '步骤 1 捕获：在区块 N 把链上状态"冻结"到一个本地 anvil 实例。',
  '步骤 2 切片：选定攻击交易，把它作为唯一的可变输入重放。',
  '步骤 3 解析：对比 baseline / victim-only / attacker-present 三条曲线，量化 MEV 成本。',
];

export function ForkExperimentPage() {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [replayCount, setReplayCount] = useState<number>(0);

  const handleReplay = (_values: ForkParamsValues) => {
    setReplayCount((n) => n + 1);
  };

  return (
    <div className="dtm-fork-page" data-testid="fork-experiment-page">
      <ExplainBox title="实验切片模式">
        从 Live 模式捕获的实时事件已被"冻结"在此。DTM 使用{' '}
        <code>anvil --fork-url</code> 克隆了主网在 Block #22180542 的完整状态。
        你现在可以在<span style={{ color: 'var(--dtm-lime)' }}>零风险沙盒</span>
        中步进执行每一笔交易，观察储备如何变化、谁赚谁亏。
      </ExplainBox>

      <div className="dtm-grid-3" data-testid="fork-experiment-grid">
        {/* LEFT: controls */}
        <div className="dtm-fork-col-left">
          <Panel title="仿真参数" testId="fork-params-panel">
            <ForkParams onReplay={handleReplay} testId="fork-params" />
          </Panel>
          <Panel title="步进控制" testId="step-controls-panel">
            <StepControls
              active={activeStep}
              onChange={setActiveStep}
              description={STEP_DESCRIPTIONS[activeStep]}
              testId="step-controls"
            />
          </Panel>
        </div>

        {/* CENTER: visualisation */}
        <div className="dtm-fork-col-center">
          <Panel title="AMM 曲线变化" testId="fork-amm-panel">
            <ForkAmmPanel testId="fork-amm" />
          </Panel>
          <Panel title="资金流向" testId="fork-sankey-panel">
            <ForkSankeyPanel testId="fork-sankey" />
          </Panel>
          <Panel title="执行轨迹" testId="fork-timeline-panel">
            <ForkTimeline testId="fork-timeline-list" />
          </Panel>
        </div>

        {/* RIGHT: results */}
        <div className="dtm-fork-col-right">
          <Panel title="量化结果" testId="quant-results-panel">
            <QuantResults testId="quant-results" />
          </Panel>
          <Panel title="实验结论" testId="fork-conclusion-panel">
            <ForkConclusion testId="fork-conclusion-body" />
          </Panel>
        </div>
      </div>

      {/* Hidden sentinel used by tests that need a stable data attribute
          counting how many times the replay button has been clicked. */}
      <span data-testid="fork-replay-count" data-count={replayCount} hidden>
        {replayCount}
      </span>
    </div>
  );
}

// Keep references to legacy components so they remain part of this
// module's surface area (avoids the `noUnusedLocals` lint rule while
// also documenting the re-exports above).
void CompareView;
void ScenarioList;

export default ForkExperimentPage;
