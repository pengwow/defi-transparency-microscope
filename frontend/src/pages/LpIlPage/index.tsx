/**
 * LpIlPage — the LP/IL microscope tab.
 *
 * Layout (2 columns, mirrors DTM_Demo.html lines 949-1038):
 *   - Top:   ExplainBox + page title
 *   - Left:  LpParams / LpScenarios / PoolStatePanel
 *   - Right: IlCurvePanel / IlPnlPanel / IlMetricsPanel
 *   - Foot:  LpExplanation (formula + explain-box)
 *
 * All panel state is sourced from the `lpStore` (V2/V3 toggle, four
 * parameter sliders, preset scenarios).  The previous
 * three-column "positions / IL curve / attribution" layout has been
 * retired — the per-position flow is replaced by the
 * scenario-driven microscope above.
 */

import {
  IlCurvePanel,
  IlMetrics,
  IlPnlPanel,
  LpExplanation,
  LpParams,
  LpScenarios,
  PoolStatePanel,
} from '@/components/lpil';
import { Panel } from '@/components/common';
import './LpIlPage.css';

export function LpIlPage() {
  return (
    <div className="dtm-page dtm-lpil-page" data-testid="lpil-page">
      <div className="dtm-lpil-page-title">🌊 LP/IL 显微镜</div>

      <div className="dtm-lpil-grid" data-testid="lpil-grid">
        <div className="dtm-lpil-col dtm-lpil-col-left">
          <Panel title="仿真参数" testId="lpil-params-panel-wrapper">
            <LpParams />
          </Panel>
          <Panel title="快速场景" testId="lpil-scenarios-panel-wrapper">
            <LpScenarios />
          </Panel>
          <Panel title="池子状态" testId="pool-state-panel">
            <PoolStatePanel />
          </Panel>
        </div>
        <div className="dtm-lpil-col dtm-lpil-col-right">
          <Panel title="IL 机理曲线" testId="il-curve-panel">
            <IlCurvePanel />
          </Panel>
          <Panel title="IL-费 归因盈亏" testId="il-pnl-panel">
            <IlPnlPanel />
          </Panel>
          <Panel title="关键指标" testId="il-metrics-panel">
            <IlMetrics />
          </Panel>
        </div>
      </div>

      <LpExplanation />
    </div>
  );
}

export default LpIlPage;
