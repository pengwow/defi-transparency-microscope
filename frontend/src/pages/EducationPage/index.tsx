/**
 * EducationPage — the 🎓 教学实验 tab.
 *
 * Layout (2 columns, mirrors DTM_Demo.html lines 1500-1800):
 *   - Top:   ScenarioList (5 MEV scenario cards)
 *   - Left:  EduParams + EduAmmPanel + EduLiveData
 *   - Right: EduExplain + DefenseTips
 *
 * All scenario / slider state is sourced from the `eduStore` so
 * picking a different card or moving a slider rewires every
 * downstream panel in real time.
 *
 * The original CheatSheet / Timeline / Glossary modules are still
 * importable on the side; they aren't part of the new layout but
 * their files are kept (iron rule 5).
 */

import { Panel } from '@/components/common';
import {
  ScenarioList,
  EduParams,
  EduAmmPanel,
  EduExplain,
  EduLiveData,
  DefenseTips,
} from '@/components/edu';
import { Timeline, type TimelineStep } from './Timeline';
import { CheatSheet, type FormulaCard } from './CheatSheet';
import { Glossary, type GlossaryEntry } from './Glossary';
import './EducationPage.css';

// Legacy modules retained for downstream consumers (iron rule 5).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _LEGACY_STEPS: ReadonlyArray<TimelineStep> = [
  { id: '1', title: 'CPMM', summary: 'x*y=k — the constant product invariant' },
  { id: '2', title: 'Impermanent Loss', summary: 'LP drift vs. HODL baseline' },
  { id: '3', title: 'Health Factor', summary: 'Lending liquidation risk' },
  { id: '4', title: 'MEV & Sandwiches', summary: 'Attacker profit extraction' },
  { id: '5', title: 'PnL Attribution', summary: 'Decomposing swap P&L' },
  { id: '6', title: 'Reporting', summary: 'Exporting a session as JSON' },
];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _LEGACY_CARDS: ReadonlyArray<FormulaCard> = [
  {
    id: 'cpmm',
    title: 'CPMM',
    formula: 'x * y = k',
    description: 'Constant product invariant.',
  },
];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _LEGACY_ENTRIES: ReadonlyArray<GlossaryEntry> = [
  { term: 'AMM', definition: 'Automated market maker.' },
];
// Surface the legacy imports so the bundler keeps the files live
// in case the page wants to re-introduce them.
const _LEGACY_IMPORTS = { Timeline, CheatSheet, Glossary };
void _LEGACY_IMPORTS;

export function EducationPage() {
  return (
    <div className="dtm-page dtm-education-page" data-testid="education-page">
      <div className="dtm-education-page-title">🎓 教学实验</div>

      <Panel title="MEV 教学场景" testId="edu-scenario-list-panel-wrapper">
        <ScenarioList />
      </Panel>

      <div className="dtm-education-grid" data-testid="education-grid">
        <div className="dtm-education-col dtm-education-col-left">
          <Panel title="实验参数" testId="edu-params-panel-wrapper">
            <EduParams />
          </Panel>
          <Panel title="AMM 路径" testId="edu-amm-panel-wrapper">
            <EduAmmPanel />
          </Panel>
          <Panel title="实时数据" testId="edu-live-data-panel-wrapper">
            <EduLiveData />
          </Panel>
        </div>
        <div className="dtm-education-col dtm-education-col-right">
          <Panel title="原理解释" testId="edu-explain-panel-wrapper">
            <EduExplain />
          </Panel>
          <Panel title="防御建议" testId="edu-defense-tips-panel-wrapper">
            <DefenseTips />
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default EducationPage;
