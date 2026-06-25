/**
 * ForkExperimentPage — placeholder.
 *
 * Renders a Panel + ExplainBox announcing the module.  The real
 * implementation (scenario list + 3-branch compare view) lands in
 * Task 19.
 */

import { ExplainBox, Panel } from '@/components/common';

export function ForkExperimentPage() {
  return (
    <Panel title="Fork Experiments" testId="fork-experiment-panel">
      <p>Pick a preset scenario, tweak its parameters, and compare a 3-branch run (baseline, victim-only, attacker-present).</p>
      <ExplainBox title="What is a fork experiment?">
        A fork experiment replays the same swap under three different
        conditions: (1) baseline with no MEV, (2) a victim-only run, and
        (3) a victim with an attacker present.  The comparison makes
        the cost of sandwiching explicit and reproducible.
      </ExplainBox>
    </Panel>
  );
}

export default ForkExperimentPage;
