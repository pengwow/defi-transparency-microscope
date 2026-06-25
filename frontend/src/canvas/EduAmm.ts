/**
 * EduAmm — visualisation of an AMM swap on a constant-product
 * (x*y=k) curve, used by the Education tab's microscope.
 *
 * The chart draws:
 *   1. The x*y=k hyperbola in cyan.
 *   2. The pre-swap reserves as a green dot (current state).
 *   3. The post-swap reserves as a red dot (after the swapSize is
 *      applied to one side of the pool).
 *   4. A coral arrow connecting the two dots, highlighting the
 *      direction of the swap and the magnitude of the price impact.
 *   5. A label near the arrow showing the slippage % ("冲击 4.5%")
 *      and a footer label showing the swap size.
 *
 * The module also exposes a tiny `setEduAmm` state hook so that the
 * React component can mirror the most recent input through the canvas
 * without the canvas needing a back-reference.  The state hook is
 * intentionally side-effect free and is consumed only by tests.
 */

import type { CanvasSize } from './types';

export interface EduAmmOptions {
  /** Reserve of token0 (x axis), in token units. */
  reserve0: number;
  /** Reserve of token1 (y axis), in token units. */
  reserve1: number;
  /** Notional swap size in token0 units; drives the post-swap dot. */
  swapSize: number;
}

interface EduAmmState {
  reserve0: number;
  reserve1: number;
  swapSize: number;
}

let lastState: EduAmmState = { reserve0: 1000, reserve1: 1000, swapSize: 100 };

/**
 * Update the most-recently-observed Edu AMM state.  Inputs are
 * clamped to safe ranges so the canvas never divides by zero.
 */
export function setEduAmm(state: EduAmmState): void {
  const reserve0 = Number.isFinite(state.reserve0) ? Math.max(0, state.reserve0) : 0;
  const reserve1 = Number.isFinite(state.reserve1) ? Math.max(0, state.reserve1) : 0;
  const swapSize = Number.isFinite(state.swapSize) ? Math.max(0, state.swapSize) : 0;
  lastState = { reserve0, reserve1, swapSize };
}

const COLOR_BG = '#0b1020';
const COLOR_AXIS = 'rgba(139, 155, 180, 0.4)';
const COLOR_CURVE = '#00e5ff';
const COLOR_PRE = '#69f0ae';
const COLOR_POST = '#ff5e5e';
const COLOR_ARROW = 'rgba(255, 94, 94, 0.55)';
const COLOR_TEXT = '#e6e8ef';
const COLOR_LABEL = '#8b9bb4';

const PAD = 24;

/**
 * Draw the AMM curve + swap arrow on the supplied context.
 * Coordinates are in CSS pixels; the `useCanvas` hook applies the
 * DPR transform before calling us.
 */
export function drawEduAmm(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  opts: EduAmmOptions,
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);

  // Background.
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, width, height);

  // Axis box.
  ctx.strokeStyle = COLOR_AXIS;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, PAD);
  ctx.lineTo(PAD, height - PAD);
  ctx.lineTo(width - PAD, height - PAD);
  ctx.stroke();

  // Derive safe values.
  const r0 = Math.max(1, opts.reserve0);
  const r1 = Math.max(1, opts.reserve1);
  const k = r0 * r1;
  const swap = Math.max(0, opts.swapSize);
  const halfSwap = swap * 0.5;

  // Plot region.
  const plotW = Math.max(1, width - PAD * 2);
  const plotH = Math.max(1, height - PAD * 2);

  // X axis spans 0 .. 2 * reserve0 (post-swap point is to the left of
  // the current dot, so we want a symmetric window).  Y axis uses
  // 0 .. 2 * reserve1 for the same reason.
  const xMax = Math.max(1, r0 * 2);
  const yMax = Math.max(1, r1 * 2);

  const toX = (v: number) => PAD + (v / xMax) * plotW;
  const toY = (v: number) => PAD + plotH - (v / yMax) * plotH;

  // Hyperbola.
  if (k > 0) {
    ctx.strokeStyle = COLOR_CURVE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const xv = (i / steps) * xMax + 1;
      const yv = k / xv;
      if (yv > yMax) continue;
      const px = toX(xv);
      const py = toY(yv);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Pre-swap dot (current reserves).
  const preX = toX(r0);
  const preY = toY(r1);
  ctx.fillStyle = COLOR_PRE;
  ctx.beginPath();
  ctx.arc(preX, preY, 5, 0, Math.PI * 2);
  ctx.fill();

  // Post-swap dot.  Constant-product: a swap of `swap` units of
  // token0 moves reserves to (r0 - halfSwap, r1 + halfSwap) to keep
  // k constant in a 50/50 weight (for the demo we keep the change
  // proportional to `swap` and clamp).
  const newR0 = Math.max(1, r0 - halfSwap);
  const newR1 = Math.max(1, r1 + halfSwap * (r1 / Math.max(1, r0)));
  const postX = toX(newR0);
  const postY = toY(newR1);
  ctx.fillStyle = COLOR_POST;
  ctx.beginPath();
  ctx.arc(postX, postY, 5, 0, Math.PI * 2);
  ctx.fill();

  // Arrow from current to post.
  ctx.strokeStyle = COLOR_ARROW;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(preX, preY);
  ctx.lineTo(postX, postY);
  ctx.stroke();

  // Slippage / impact label, placed near the post-swap dot.
  const impactPct = r0 > 0 ? (Math.abs(r0 - newR0) / r0) * 100 * 1.8 : 0;
  ctx.fillStyle = COLOR_POST;
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`冲击 ${impactPct.toFixed(1)}%`, postX + 8, postY - 8);

  // Title.
  ctx.fillStyle = COLOR_TEXT;
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`AMM 路径 · swap ${swap.toFixed(0)} 单位`, PAD, 14);

  // Footer swap size.
  ctx.fillStyle = COLOR_LABEL;
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText(
    `Reserves ${r0.toFixed(0)} / ${r1.toFixed(0)}`,
    PAD,
    height - 8,
  );

  // Reset alignment.
  ctx.textAlign = 'start';

  // Mirror state for test introspection.
  lastState = { reserve0: r0, reserve1: r1, swapSize: swap };
}

// Expose the latest state for unit tests.
export function _getEduAmmState(): EduAmmState {
  return lastState;
}
