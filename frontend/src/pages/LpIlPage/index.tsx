/**
 * LpIlPage — track LP positions and their impermanent loss.
 *
 * Three columns:
 *   1. LP Positions    — clickable list of positions, with derived APR
 *      and USD value.
 *   2. IL Curve        — canvas that draws the V2 (and V3, if
 *      applicable) impermanent-loss curve for the selected position.
 *   3. PnL Attribution — table of fees, rewards, IL, and net P&L.
 *
 * The page selects the first position by default and re-draws the
 * IL curve on every selection change.
 */

import { useEffect, useMemo, useState } from 'react';
import { ExplainBox, Panel } from '@/components/common';
import { draw as drawILCurve } from '@/canvas/ILCurve';
import { useCanvas } from '@/canvas/useCanvas';
import { usePositionStore } from '@/store/positionStore';
import { calculateV2IL, calculateV3IL } from '@/algorithms/il';
import type { Position } from '@/types';
import { PositionList, type LpPositionRow } from './PositionList';
import { AttributionTable, type AttributionRow } from './AttributionTable';
import './LpIlPage.css';

const ONE_E18 = 10n ** 18n;

/** Build the display rows the PositionList consumes, with derived APR + value. */
function buildRows(positions: ReadonlyArray<Position>): LpPositionRow[] {
  return positions.map((p, idx) => {
    // Derive a notional APR seeded by the position's id and amount0 (deterministic).
    const seed = (p.id.length + idx + 1) % 10;
    const apr = 0.05 + (seed / 100); // 5%..15%
    // USD value = (amount0 + amount1) / 1e18 (mock).  For V3, fall back to
    // liquidity / 1e18 if amount0/amount1 are missing.
    const amount0 = (p as { amount0?: bigint }).amount0 ?? 0n;
    const amount1 = (p as { amount1?: bigint }).amount1 ?? 0n;
    const value = Number(amount0 + amount1) / Number(ONE_E18);
    return {
      id: p.id,
      apr,
      value: Number.isFinite(value) ? value : 0,
      protocol: p.protocol,
    };
  });
}

/** Build the attribution row (fees, rewards, IL) for a single position. */
function buildAttribution(p: Position | undefined): AttributionRow | null {
  if (!p) return null;
  // Mock fees from tokensOwed (V3) or amount0 (V2).
  const tokensOwed0 = (p as { tokensOwed0?: bigint }).tokensOwed0 ?? 0n;
  const tokensOwed1 = (p as { tokensOwed1?: bigint }).tokensOwed1 ?? 0n;
  const feesRaw = tokensOwed0 + tokensOwed1 + (p as { amount0?: bigint }).amount0! / 10n;
  const rewardsRaw = (p as { amount0?: bigint }).amount0! / 50n;
  const fees = Number(feesRaw) / Number(ONE_E18);
  const rewards = Number(rewardsRaw) / Number(ONE_E18);

  // IL at a 1.5x price drift; V3 uses a degenerate-range fallback (V2 formula).
  let il: number;
  if (p.protocol === 'uniswap_v3') {
    const pLower = Math.pow(1.0001, p.tickLower);
    const pUpper = Math.pow(1.0001, p.tickUpper);
    il = calculateV3IL(1.5, pLower, pUpper);
  } else {
    il = calculateV2IL(1.5);
  }
  // Convert IL fraction to USD-scaled (assume $1k of value as the notional).
  const ilUsd = il * 1000;
  return {
    id: p.id,
    fees: Number.isFinite(fees) ? fees : 0,
    rewards: Number.isFinite(rewards) ? rewards : 0,
    il: Number.isFinite(ilUsd) ? ilUsd : 0,
  };
}

export function LpIlPage() {
  const positions = usePositionStore((s) => s.lp);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default to the first position.
  useEffect(() => {
    if (selectedId === null && positions.length > 0) {
      setSelectedId(positions[0].id);
    }
  }, [selectedId, positions]);

  const rows = useMemo(() => buildRows(positions), [positions]);
  const selected = positions.find((p) => p.id === selectedId);
  // If the selected id no longer matches, fall back to the first position so
  // the canvas + table still have something to render.
  const active = selected ?? positions[0];
  const attribution = useMemo(() => buildAttribution(active), [active]);

  // IL curve canvas — re-renders when the selected position changes.
  const ilCanvas = useCanvas(
    (ctx, size) => {
      if (active) drawILCurve(ctx, size, { position: active });
    },
    [active],
  );

  return (
    <div className="dtm-lp-il-grid" data-testid="lp-il-page">
      <Panel title="LP Positions" testId="lp-positions-panel">
        <PositionList
          rows={rows}
          selectedId={active?.id ?? null}
          onSelect={setSelectedId}
        />
        <ExplainBox title="Reading the list">
          Each row shows one of your LP positions: the notional APR
          (annualised fees + rewards), and the USD value of the
          underlying tokens.  Click a row to inspect the IL curve
          and P&amp;L breakdown.
        </ExplainBox>
      </Panel>

      <Panel title="IL Curve" testId="il-curve-panel">
        {active ? (
          <canvas
            ref={ilCanvas.ref}
            className="dtm-canvas dtm-canvas-il"
            data-testid="il-canvas"
          />
        ) : (
          <p className="muted">Add a position to see its impermanent loss curve.</p>
        )}
        <ExplainBox title="What does the curve show?">
          The blue curve is the closed-form V2 IL formula,
          2*sqrt(p)/(1+p) - 1.  For a V3 position the amber curve
          adds the concentrated range (in-range IL is amplified by
          1/concentration; out-of-range it plateaus).  The X axis is
          price ratio (new/old), Y is IL fraction.
        </ExplainBox>
      </Panel>

      <Panel title="PnL Attribution" testId="pnl-attribution-panel">
        <AttributionTable row={attribution} />
        <ExplainBox title="How is PnL attributed?">
          Net P&amp;L = fees + rewards + IL.  Fees and rewards are
          the LP's positive cash flows; IL is always a cost (the
          difference between holding the basket and holding the LP
          position).  Use the curve on the left to see how IL scales
          with price drift.
        </ExplainBox>
      </Panel>
    </div>
  );
}

export default LpIlPage;
