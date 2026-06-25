/**
 * LiveSamplingPage — the live mempool inspection view.
 *
 * Three columns:
 *   1. AMM Curve  — canvas rendered from `AmmCurve.draw`, redraws on
 *      mempool / price changes via the `useCanvas` hook.
 *   2. Sandwich Feed — clickable list of mempool entries backed by
 *      the full mock transaction (for amounts).
 *   3. Inspector — details of the currently selected transaction,
 *      with a sandwich bundle breakdown when present.
 *
 * A setInterval pushes a new mempool entry every 1500ms to simulate
 * a live feed.  The pool and the full transaction list are loaded
 * once on mount from the mock API.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ExplainBox, Panel } from '@/components/common';
import { draw as drawAmmCurve } from '@/canvas/AmmCurve';
import { useCanvas } from '@/canvas/useCanvas';
import { useLiveStore } from '@/store/liveStore';
import { MockAPI } from '@/services/mockApi';
import type { MockTransaction } from '@/mocks/transactions';
import type { Pool } from '@/types';
import { Inspector } from './Inspector';
import { SandwichFeed } from './SandwichFeed';
import './LiveSamplingPage.css';

const api = new MockAPI();
const TICK_MS = 1500;

export function LiveSamplingPage() {
  const mempool = useLiveStore((s) => s.mempool);
  const ammPrice = useLiveStore((s) => s.ammPriceE18);
  const [pool, setPool] = useState<Pool | null>(null);
  const [allTxs, setAllTxs] = useState<MockTransaction[]>([]);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const cycleRef = useRef(0);

  // Load pool + transactions once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pools, txs] = await Promise.all([api.listPools(), api.listTransactions()]);
      if (cancelled) return;
      const live =
        pools.find((p) => p.token0.symbol === 'ETH' && p.token1.symbol === 'USDC') ?? pools[0];
      setPool(live ?? null);
      setAllTxs(txs);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Periodic push to keep the live feed ticking.
  useEffect(() => {
    if (allTxs.length === 0) return;
    const id = setInterval(() => {
      const cycle = cycleRef.current++ % allTxs.length;
      const next = allTxs[cycle];
      if (!next) return;
      useLiveStore.getState().pushTx({
        hash: next.hash,
        from: next.from,
        timestamp: Math.floor(Date.now() / 1000),
        mevType: next.mevType,
      });
      // Tick the AMM price by a tiny delta so the chart re-renders.
      const current = useLiveStore.getState().ammPriceE18;
      const delta = current / 1000n;
      useLiveStore.getState().setAmmPrice(current + delta);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [allTxs]);

  // Selected tx from the full transaction list (for swap details).
  const selectedTx = useMemo(
    () => (selectedHash ? allTxs.find((t) => t.hash === selectedHash) ?? null : null),
    [selectedHash, allTxs],
  );

  // Build a hash→tx lookup for the feed's amount column.
  const txsByHash = useMemo(() => {
    const m = new Map<string, MockTransaction>();
    for (const t of allTxs) m.set(t.hash, t);
    return m;
  }, [allTxs]);

  // Canvas draw: re-runs whenever mempool length or price changes.
  const { ref } = useCanvas(
    (ctx, size) => {
      if (pool) drawAmmCurve(ctx, size, pool, allTxs);
    },
    [ammPrice, mempool],
  );

  return (
    <div className="dtm-live-grid" data-testid="live-sampling-grid">
      <Panel title="AMM Curve" testId="amm-curve-panel">
        <canvas ref={ref} className="dtm-canvas dtm-canvas-curve" />
        <ExplainBox title="What does the AMM curve show?">
          The blue curve is the constant-product hyperbola x*y=k.  Each
          dot is a historic swap: red when token0 was sold, green when
          token1 was sold.  The yellow dot is the current reserves.
        </ExplainBox>
      </Panel>

      <Panel title="Sandwich Feed" testId="sandwich-feed-panel">
        <SandwichFeed
          entries={mempool}
          txs={txsByHash}
          selectedHash={selectedHash}
          onSelect={setSelectedHash}
        />
        <ExplainBox title="What is the feed?">
          A live sample of pending transactions.  Sandwich attacks
          appear in red, arbitrage in amber, JIT liquidity in cyan,
          and liquidations in blue.  Click a row to inspect it.
        </ExplainBox>
      </Panel>

      <Panel title="Inspector" testId="inspector-panel">
        <Inspector tx={selectedTx} />
        <ExplainBox title="What is the inspector?">
          The inspector shows the full transaction payload: hash, block,
          gas, and decoded swap amounts.  Sandwiches also display the
          bundled frontrun / victim / backrun transactions.
        </ExplainBox>
      </Panel>
    </div>
  );
}

export default LiveSamplingPage;
