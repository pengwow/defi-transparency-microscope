/**
 * ILCurve — visualise impermanent loss vs. price drift.
 *
 * Draws two curves: V2 IL (full range) and V3 IL (concentrated, using
 * the position's tickLower / tickUpper).  X axis is the multiplicative
 * price ratio (relative to entry), Y axis is IL in percent.
 *
 * For V2 we use the well-known closed-form formula.  For V3 we
 * approximate with the same formula, scaled by the inverse of the
 * concentration factor (1/sqrt(P_upper / P_lower)).
 */

import type { CanvasSize } from './types';
import type { Position } from '@/types';
import { calculateV2IL, calculateV3IL } from '@/algorithms/il';

export interface ILCurveOptions {
  position: Position;
  /** Optional y-axis range multiplier; default 0.5 (-50% IL max). */
  maxIlPct?: number;
}

/** Compute price from a tick (V3).  p = 1.0001^tick. */
function priceFromTick(tick: number): number {
  return Math.pow(1.0001, tick);
}

/** Draw the IL comparison chart. */
export function draw(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  options: ILCurveOptions,
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  const pad = 24;
  const plotW = Math.max(1, width - pad * 2);
  const plotH = Math.max(1, height - pad * 2);

  // Build X range from position's tick range (V3) or default ±50%.
  let lower = 0.5;
  let upper = 2.0;
  if (options.position.protocol === 'uniswap_v3') {
    const pLower = priceFromTick(options.position.tickLower);
    const pUpper = priceFromTick(options.position.tickUpper);
    const cur = priceFromTick((options.position.tickLower + options.position.tickUpper) / 2);
    const span = Math.max(pUpper / pLower, 2);
    lower = cur / span;
    upper = cur * span;
  }

  const maxIlPct = options.maxIlPct ?? 0.5; // y axis goes from -50% to +50% (zero is middle)
  const steps = 64;

  const toX = (r: number) => pad + ((r - lower) / (upper - lower)) * plotW;
  // IL is negative ⇒ map to upper half.  We treat 0 as the bottom of the chart
  // and -maxIlPct as the top.  Anything positive is clamped.
  const toY = (il: number) => {
    const t = Math.max(0, Math.min(1, -il / maxIlPct));
    return pad + (1 - t) * plotH;
  };

  // Axes.
  ctx.strokeStyle = '#1f2a44';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, pad + plotH);
  ctx.lineTo(pad + plotW, pad + plotH);
  ctx.stroke();

  // Zero line.
  const zeroY = toY(0);
  ctx.strokeStyle = '#4a5878';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(pad, zeroY);
  ctx.lineTo(pad + plotW, zeroY);
  ctx.stroke();
  ctx.setLineDash([]);

  // V2 curve.
  ctx.strokeStyle = '#4f8cff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const ratio = lower + (i / steps) * (upper - lower);
    const il = calculateV2IL(ratio);
    const x = toX(ratio);
    const y = toY(il);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // V3 curve (only for V3 positions).
  if (options.position.protocol === 'uniswap_v3') {
    const pLower = priceFromTick(options.position.tickLower);
    const pUpper = priceFromTick(options.position.tickUpper);
    ctx.strokeStyle = '#ffb84f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const ratio = lower + (i / steps) * (upper - lower);
      const il = calculateV3IL(ratio, pLower, pUpper);
      const x = toX(ratio);
      const y = toY(il);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Title and legend.
  ctx.fillStyle = '#e6e8ef';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('Impermanent Loss vs price ratio', pad, 14);
  ctx.fillStyle = '#4f8cff';
  ctx.fillRect(pad, height - 20, 8, 8);
  ctx.fillStyle = '#e6e8ef';
  ctx.fillText('V2', pad + 12, height - 13);
  if (options.position.protocol === 'uniswap_v3') {
    ctx.fillStyle = '#ffb84f';
    ctx.fillRect(pad + 50, height - 20, 8, 8);
    ctx.fillStyle = '#e6e8ef';
    ctx.fillText('V3', pad + 62, height - 13);
  }
}
