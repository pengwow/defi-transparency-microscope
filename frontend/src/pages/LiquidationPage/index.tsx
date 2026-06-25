/**
 * LiquidationPage — the lending liquidation risk view.
 *
 * Three columns:
 *   1. Position list — clickable list of lending positions, with HF.
 *   2. HF bar chart  — one bar per position, threshold line at 1.0.
 *   3. Risk gauge    — needle pointing at the selected position's HF.
 */

import { useEffect, useState } from 'react';
import { ExplainBox, Panel } from '@/components/common';
import { useCanvas } from '@/canvas/useCanvas';
import { draw as drawGauge } from '@/canvas/Gauge';
import { usePositionStore } from '@/store/positionStore';
import { calculateHealthFactor } from '@/algorithms/hf';
import { draw as drawHFBar } from './HFChart';
import { PositionList } from './PositionList';
import './LiquidationPage.css';

const ONE_E18 = 10n ** 18n;

function totalToken(map: Record<string, bigint>): bigint {
  let s = 0n;
  for (const v of Object.values(map)) s += v;
  return s;
}

function hfOf(p: { collateral: Record<string, bigint>; debt: Record<string, bigint>; liquidationThresholdE18: bigint }): number {
  const coll = totalToken(p.collateral);
  const debt = totalToken(p.debt);
  if (debt === 0n) return 10;
  return Number(calculateHealthFactor(coll, debt, p.liquidationThresholdE18)) / Number(ONE_E18);
}

export function LiquidationPage() {
  const positions = usePositionStore((s) => s.lending);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Select the first position by default once the list loads.
  useEffect(() => {
    if (selectedId === null && positions.length > 0) {
      setSelectedId(positions[0].id);
    }
  }, [selectedId, positions]);

  const selected = positions.find((p) => p.id === selectedId) ?? null;
  const selectedHF = selected ? hfOf(selected) : 0;

  // HF bar chart re-runs when positions or selection changes.
  const hfCanvas = useCanvas(
    (ctx, size) => drawHFBar(ctx, size, { positions, threshold: 1.0 }),
    [positions, selectedId],
  );

  // Risk gauge re-runs when the selected position changes.
  const gaugeCanvas = useCanvas(
    (ctx, size) => drawGauge(ctx, size, { value: selectedHF, max: 3, label: 'HF' }),
    [selectedHF],
  );

  return (
    <div className="dtm-liquidation-grid" data-testid="liquidation-grid">
      <Panel title="Positions" testId="positions-panel">
        <PositionList
          positions={positions}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <ExplainBox title="Health Factor">
          HF equals (collateral * liquidation threshold) / debt.  A
          position is liquidatable when HF &lt; 1.0; 1.0 - 1.05 is the
          danger zone, 1.05 - 1.5 needs watching, 1.5 - 2.0 is ok, and
          above 2.0 is safe.
        </ExplainBox>
      </Panel>

      <Panel title="Health Factor" testId="hf-chart-panel">
        <canvas ref={hfCanvas.ref} className="dtm-canvas dtm-canvas-hf" />
        <ExplainBox title="What does this show?">
          One bar per position.  Bars under the dashed red line
          (HF = 1.0) are liquidatable; the further above, the safer.
        </ExplainBox>
      </Panel>

      <Panel title="Risk Gauge" testId="risk-gauge-panel">
        <canvas ref={gaugeCanvas.ref} className="dtm-canvas dtm-canvas-gauge" />
        <p className="dtm-risk-gauge-readout">
          Selected HF: <span className="mono">{selectedHF.toFixed(3)}</span>
        </p>
        <ExplainBox title="Reading the gauge">
          The needle points at the selected position's HF on a 0-3
          scale.  Red zone is &lt; 1.0 (liquidatable), amber is 1.0 -
          1.5, green is &gt; 1.5.
        </ExplainBox>
      </Panel>
    </div>
  );
}

export default LiquidationPage;
