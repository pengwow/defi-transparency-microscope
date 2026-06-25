/**
 * ForkExperimentPage — the experiment runner view.
 *
 * Two columns:
 *   1. Scenario list — clickable list of presets.
 *   2. Compare view  — 3-branch comparison table for the currently
 *      opened scenario (baseline / victim-only / attacker-present).
 *
 * The page opens the first scenario by default if none is opened.
 */

import { useEffect } from 'react';
import { ExplainBox, Panel } from '@/components/common';
import { useExperimentStore } from '@/store/experimentStore';
import { CompareView } from './CompareView';
import { ScenarioList } from './ScenarioList';
import './ForkExperimentPage.css';

export function ForkExperimentPage() {
  const scenarios = useExperimentStore((s) => s.scenarios);
  const opened = useExperimentStore((s) => s.opened);
  const open = useExperimentStore((s) => s.open);

  // Open the first scenario by default so the compare view has data.
  useEffect(() => {
    if (!opened && scenarios.length > 0) {
      open(scenarios[0].id);
    }
  }, [opened, scenarios, open]);

  return (
    <div className="dtm-fork-grid" data-testid="fork-experiment-grid">
      <Panel title="Scenarios" testId="scenario-list-panel">
        <ScenarioList
          scenarios={scenarios}
          selectedId={opened?.id ?? null}
          onSelect={open}
        />
        <ExplainBox title="What are these?">
          Fork experiments let you replay a swap under three different
          conditions to surface the cost of MEV.  Pick a preset to see
          its 3-branch comparison on the right.
        </ExplainBox>
      </Panel>

      <Panel title="Comparison" testId="compare-view-panel">
        {opened ? (
          <CompareView scenario={opened} />
        ) : (
          <p className="muted">Pick a scenario from the left to see the 3-branch comparison.</p>
        )}
        <ExplainBox title="Reading the table">
          Baseline = no victim, no attacker.  Victim-only = the victim
          trade, no MEV extraction.  Attacker-present = the full
          sandwich (frontrun + victim + backrun).  The difference
          between the last two columns is the cost of MEV.
        </ExplainBox>
      </Panel>
    </div>
  );
}

export default ForkExperimentPage;
