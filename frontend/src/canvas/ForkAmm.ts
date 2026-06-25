/**
 * ForkAmm — visualize the constant-product (x*y=k) AMM curve as it
 * migrates across a sandwich attack.
 *
 * The chart is a single hyperbola derived from the current reserves
 * (reserve0, reserve1).  Three marker dots are drawn on top of the
 * curve to indicate:
 *   1. pre   — reserves before the attacker's front-run,
 *   2. victim — the victim's swap mid-curve,
 *   3. post  — reserves after the back-run.
 *
 * All amounts are normalised to chart coordinates in `draw()`.  The
 * underlying state is held in a module-level object so that the
 * surrounding React component can call `setForkAmmState()` to update
 * the curve markers between frames.
 */

import type { CanvasSize } from './types';

/** A single (x, y) point on the constant-product curve. */
export interface ForkAmmPoint {
  x: number;
  y: number;
}

/** Full state of the fork AMM chart. */
export interface ForkAmmState {
  /** Token-0 reserve (in raw human-readable units, e.g. WETH). */
  reserve0: number;
  /** Token-1 reserve (in raw human-readable units, e.g. USDC). */
  reserve1: number;
  /** Pool depth in WETH used for size scaling. */
  depth: number;
  pre: ForkAmmPoint;
  victim: ForkAmmPoint;
  post: ForkAmmPoint;
}

const DEFAULT_STATE: ForkAmmState = {
  reserve0: 1000,
  reserve1: 2_000_000,
  depth: 1000,
  pre: { x: 980, y: 2_040_000 },
  victim: { x: 1000, y: 2_000_000 },
  post: { x: 1020, y: 1_960_000 },
};

let state: ForkAmmState = { ...DEFAULT_STATE };

/** Replace the chart's underlying state. */
export function setForkAmmState(next: ForkAmmState): void {
  state = { ...next };
}

/** Read-only view of the current state. */
export function getForkAmmState(): ForkAmmState {
  return state;
}

/** Restore the default seed state. */
export function resetForkAmm(): void {
  state = { ...DEFAULT_STATE };
}

export interface ForkAmmOpts {
  /** Optional override for the token-0 label. */
  token0Label?: string;
  /** Optional override for the token-1 label. */
  token1Label?: string;
}

/** Draw the fork AMM chart. */
export function drawForkAmm(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  opts: ForkAmmOpts = {},
): void {
  const { width, height } = size;
  const token0 = opts.token0Label ?? 'WETH';
  const token1 = opts.token1Label ?? 'USDC';

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  const padL = 36;
  const padR = 12;
  const padT = 18;
  const padB = 22;
  const plotW = Math.max(1, width - padL - padR);
  const plotH = Math.max(1, height - padT - padB);

  // Compute bounds from state.
  const points = [state.pre, state.victim, state.post];
  const xs = points.map((p) => p.x).concat(state.reserve0);
  const ys = points.map((p) => p.y).concat(state.reserve1);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xSpan = Math.max(1, xMax - xMin);
  const ySpan = Math.max(1, yMax - yMin);

  const toX = (v: number) => padL + ((v - xMin) / xSpan) * plotW;
  const toY = (v: number) => padT + (1 - (v - yMin) / ySpan) * plotH;

  // Axes.
  ctx.strokeStyle = '#1f2a44';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.stroke();

  // Axis labels.
  ctx.fillStyle = '#8b9bb4';
  ctx.font = '9px system-ui, sans-serif';
  ctx.fillText(token0, padL, padT + plotH + 12);
  ctx.fillText(token1, 4, padT + 6);

  // Constant-product hyperbola (x*y=k, k=reserve0*reserve1).
  const k = state.reserve0 * state.reserve1;
  if (k > 0 && isFinite(k)) {
    ctx.strokeStyle = '#4f8cff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const steps = 64;
    for (let i = 0; i <= steps; i++) {
      const xv = xMin + (i / steps) * (xMax - xMin);
      if (xv <= 0) continue;
      const yv = k / xv;
      if (!isFinite(yv) || yv < yMin || yv > yMax) continue;
      const px = toX(xv);
      const py = toY(yv);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Marker drawing helper.
  const drawMarker = (p: ForkAmmPoint, color: string, radius: number): void => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(toX(p.x), toY(p.y), radius, 0, Math.PI * 2);
    ctx.fill();
  };

  drawMarker(state.pre, '#5bd17b', 4); // green = pre
  drawMarker(state.victim, '#ffd166', 5); // amber = victim
  drawMarker(state.post, '#ff6b6b', 4); // coral = post

  // Title.
  ctx.fillStyle = '#e6e8ef';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`x*y=k  ${token0}/${token1}`, padL, 12);
}
