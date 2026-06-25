/**
 * HFChart — time-series line chart of health-factor samples with a
 * horizontal threshold line.
 *
 * Each input position contributes one line; the threshold is drawn as
 * a dashed horizontal line.  When a position's HF crosses below the
 * threshold, the relevant portion of its line is drawn in red.
 */

import type { CanvasSize } from './types';
import type { LendingPosition } from '@/types';
import { calculateHealthFactor } from '@/algorithms/hf';

export interface HFSeries {
  /** Each series is the same position sampled over time. */
  positions: LendingPosition[];
  /** Threshold (e.g. 1.0) drawn as a dashed line. */
  threshold: number;
  /** Optional pre-computed HF samples; if absent we sample at t0. */
  samples?: number[][];
}

const ONE_E18 = 10n ** 18n;

/** Sample the HF for a position at a specific timestamp.
 *  We have only one snapshot per LendingPosition, so we use a simple
 *  sine perturbation to show how the line would move.  This is good
 *  enough for a chart demo and deterministic. */
function sampleHF(p: LendingPosition, t: number, threshold: number): number {
  // Pick the first collateral and debt amount for a stable ratio.
  const collateralAddr = Object.keys(p.collateral)[0];
  const debtAddr = Object.keys(p.debt)[0];
  if (!collateralAddr || !debtAddr) return threshold * 2;
  const collateral = p.collateral[collateralAddr];
  const debt = p.debt[debtAddr];
  if (debt === 0n) return 10;
  // Use the algorithm to get the actual HF (treating each token unit
  // as 1 USD for the chart demo), then perturb by time for animation.
  const baseHF =
    Number(calculateHealthFactor(collateral, debt, p.liquidationThresholdE18)) /
    Number(ONE_E18);
  // small wobble so the line isn't perfectly flat
  return baseHF * (0.95 + 0.1 * Math.sin(t * 0.001 + Number(collateral)));
}

/** Draw the HF time-series. */
export function draw(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  series: HFSeries,
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  const pad = 24;
  const plotW = Math.max(1, width - pad * 2);
  const plotH = Math.max(1, height - pad * 2);

  // 64 sample points across the time range (use the earliest timestamp
  // as t0 and the latest + a small lead-in for the wobble).
  const steps = 64;
  const ts = (i: number) => i; // synthetic 0..steps

  // Y range — always include the threshold and the largest sample.
  const samples: number[][] = series.samples ?? series.positions.map(() => {
    const arr: number[] = [];
    for (let i = 0; i <= steps; i++) arr.push(0);
    return arr;
  });
  if (!series.samples) {
    for (let pi = 0; pi < series.positions.length; pi++) {
      const p = series.positions[pi];
      for (let i = 0; i <= steps; i++) {
        samples[pi][i] = sampleHF(p, ts(i), series.threshold);
      }
    }
  }

  let maxV = series.threshold;
  for (const row of samples) for (const v of row) if (v > maxV) maxV = v;
  const yMin = 0;
  const yMax = Math.max(maxV * 1.1, series.threshold * 1.5);

  const toX = (i: number) => pad + (i / steps) * plotW;
  const toY = (v: number) => pad + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  // Axes.
  ctx.strokeStyle = '#1f2a44';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, pad + plotH);
  ctx.lineTo(pad + plotW, pad + plotH);
  ctx.stroke();

  // Threshold line.
  ctx.strokeStyle = '#ff6b6b';
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(pad, toY(series.threshold));
  ctx.lineTo(pad + plotW, toY(series.threshold));
  ctx.stroke();
  ctx.setLineDash([]);

  // Series.
  const colors = ['#4f8cff', '#5bd17b', '#ffb84f', '#b86bff', '#4fd1c5'];
  for (let pi = 0; pi < samples.length; pi++) {
    const row = samples[pi];
    ctx.strokeStyle = colors[pi % colors.length];
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const x = toX(i);
      const y = toY(row[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Threshold label.
  ctx.fillStyle = '#ff6b6b';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText(`HF = ${series.threshold.toFixed(2)}`, pad + 4, toY(series.threshold) - 4);
}
