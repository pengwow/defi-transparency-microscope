/**
 * LiquidationPage — placeholder.
 *
 * Renders a Panel + ExplainBox announcing the module.  The real
 * implementation (positions + HF bar chart + risk gauge) lands in
 * Task 20.
 */

import { ExplainBox, Panel } from '@/components/common';

export function LiquidationPage() {
  return (
    <Panel title="Liquidation Risk" testId="liquidation-panel">
      <p>Inspect lending positions, health factors, and distance to the liquidation threshold.</p>
      <ExplainBox title="What is liquidation risk?">
        A lending position is liquidatable when its health factor (HF)
        falls below 1.0.  HF equals collateral value times the
        liquidation threshold, divided by debt.  This page surfaces
        positions with the smallest margin to liquidation.
      </ExplainBox>
    </Panel>
  );
}

export default LiquidationPage;
