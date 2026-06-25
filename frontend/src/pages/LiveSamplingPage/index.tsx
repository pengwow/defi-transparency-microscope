/**
 * LiveSamplingPage — placeholder.
 *
 * Renders a Panel + ExplainBox announcing the module.  The real
 * implementation (AMM curve + sandwich feed + inspector) lands in
 * Task 18.
 */

import { ExplainBox, Panel } from '@/components/common';

export function LiveSamplingPage() {
  return (
    <Panel title="Live MEV Sampling" testId="live-sampling-panel">
      <p>Watch the mempool in real time: AMM curve, sandwich feed, and an inspector for the selected transaction.</p>
      <ExplainBox title="What is MEV sampling?">
        MEV (Maximal / Miner Extractable Value) sampling means observing
        pending transactions in the mempool and classifying them as
        normal, sandwich, arbitrage, JIT-liquidity, or liquidation.
        This page shows the live feed of those observations and the
        AMM curve they affect.
      </ExplainBox>
    </Panel>
  );
}

export default LiveSamplingPage;
