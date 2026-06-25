/**
 * LpIlPage — placeholder.
 *
 * Renders a Panel + ExplainBox announcing the module.  The real
 * implementation (LP positions + IL curve + PnL attribution) lands in
 * Task 21.
 */

import { ExplainBox, Panel } from '@/components/common';

export function LpIlPage() {
  return (
    <Panel title="LP Impermanent Loss" testId="lp-il-panel">
      <p>Track liquidity-provider positions, plot impermanent loss vs. price drift, and decompose PnL into fees, rewards, and IL.</p>
      <ExplainBox title="What is impermanent loss?">
        Impermanent loss is the difference in value between an LP
        position and a HODL baseline, as the pool's price drifts away
        from entry.  For a V2 pool the closed-form IL(p) is
        2*sqrt(p) / (1 + p) - 1.  V3 positions concentrate this
        exposure inside their tick range.
      </ExplainBox>
    </Panel>
  );
}

export default LpIlPage;
