/**
 * HFChart (Liquidation) — bar chart of health factors.
 *
 * One bar per position: bar height is proportional to the position's
 * HF.  The threshold (default 1.0) is drawn as a horizontal dashed
 * line.  Bars whose HF is below the threshold are coloured red;
 * above-threshold bars are coloured by risk band.
 *
 * This is a different file from `canvas/HFChart.ts`, which renders a
 * time-series line chart.
 */

import type { CanvasSize } from '@/canvas/types';
import type { LendingPosition } from '@/types';
import { calculateHealthFactor } from '@/algorithms/hf';

export interface HFBarInput {
  positions: ReadonlyArray<LendingPosition>;
  threshold: number;
}

const ONE_E18 = 10n ** 18n;

function hfOf(p: LendingPosition): number {
  const coll = Object.values(p.collateral).reduce((a, b) => a + b, 0n);
  const debt = Object.values(p.debt).reduce((a, b) => a + b, 0n);
  if (debt === 0n) return 10;
  return (
    Number(calculateHealthFactor(coll, debt, p.liquidationThresholdE18)) /
    Number(ONE_E18)
  );
}

function colorFor(hf: number, threshold: number): string {
  if (hf < threshold) return '#ff6b6b';
  if (hf < threshold * 1.05) return '#ffb84f';
  if (hf < threshold * 1.5) return '#4fd1c5';
  return '#5bd17b';
}

export function draw(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  input: HFBarInput,
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  const pad = 32;
  const plotW = Math.max(1, width - pad * 2);
  const plotH = Math.max(1, height - pad * 2);

  const hfs = input.positions.map(hfOf);
  if (hfs.length === 0) {
    ctx.fillStyle = '#7a8aa8';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('No positions', pad, pad + 12);
    return;
  }

  const maxV = Math.max(...hfs, input.threshold * 2);
  const yMax = maxV * 1.1;

  // Axes.
  ctx.strokeStyle = '#1f2a44';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, pad + plotH);
  ctx.lineTo(pad + plotW, pad + plotH);
  ctx.stroke();

  // Threshold.
  const ty = pad + (1 - input.threshold / yMax) * plotH;
  ctx.strokeStyle = '#ff6b6b';
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, ty);
  ctx.lineTo(pad + plotW, ty);
  ctx.stroke();
  ctx.setLineDash([]);

  // Bars.
  const slot = plotW / hfs.length;
  const barW = Math.max(6, slot * 0.6);
  for (let i = 0; i < hfs.length; i++) {
    const hf = hfs[i];
    const x = pad + i * slot + (slot - barW) / 2;
    const y = pad + (1 - hf / yMax) * plotH;
    const h = pad + plotH - y;
    ctx.fillStyle = colorFor(hf, input.threshold);
    ctx.fillRect(x, y, barW, h);

    // Label.
    ctx.fillStyle = '#7a8aa8';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(hf.toFixed(2), x + barW / 2, pad + plotH + 12);
    const pos = input.positions[i];
    ctx.fillText(pos.id, x + barW / 2, pad + plotH + 24);
  }
  ctx.textAlign = 'start';

  // Threshold label.
  ctx.fillStyle = '#ff6b6b';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText(`HF ${input.threshold.toFixed(2)}`, pad + 4, ty - 4);
}
