/**
 * AmmDisturbance — visualise an AMM pool being attacked (a "disturbance"
 * on the x*y=k curve).
 *
 * The renderer:
 *   1. draws the constant-product hyperbola from the current reserves,
 *   2. places a pulsing red circle at the attack point (current reserves
 *      after a large swap has moved the pool),
 *   3. draws a dashed line from the original reserves to the new
 *      reserves to illustrate the disturbance.
 *
 * The state is held in a module-level object so React components can
 * update it via `setDisturbance(...)` between rAF frames.
 */

import type { CanvasSize } from './types';

export interface DisturbanceState {
  /** Token-0 reserve (raw human-readable). */
  reserve0: number;
  /** Token-1 reserve (raw human-readable). */
  reserve1: number;
  /** Attack size in token-0 (raw).  Default 0 = no marker. */
  attackSize: number;
  /** Color of the attack marker (default coral). */
  color: string;
}

export interface AmmDisturbanceOptions {
  /** Pulse phase in [0, 1] used to scale the attack marker. */
  pulse?: number;
}

const DEFAULT_STATE: DisturbanceState = {
  reserve0: 1000,
  reserve1: 2_000_000,
  attackSize: 0,
  color: '#ff5e5e',
};

let state: DisturbanceState = { ...DEFAULT_STATE };

/** Replace the disturbance state. */
export function setDisturbance(next: Partial<DisturbanceState>): void {
  state = { ...state, ...next };
}

/** Read-only view of the current state. */
export function getDisturbance(): DisturbanceState {
  return state;
}

/** Compute the k=xy constant. */
function computeK(r0: number, r1: number): number {
  return r0 * r1;
}

/** Draw the AMM disturbance chart. */
export function drawAmmDisturbance(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  options: AmmDisturbanceOptions,
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  const pulse = options.pulse ?? 0.5;

  // Original reserves (pre-attack) — use the geometric mean of state
  // and the post-attack reserves (reserve - attackSize).
  const preR0 = state.reserve0;
  const preR1 = state.reserve1;
  const postR0 = Math.max(1, preR0 - state.attackSize);
  const postR1 = preR1 > 0 ? (preR0 * preR1) / postR0 : preR1;

  // Axes / plot area.
  const pad = 24;
  const plotW = Math.max(1, width - pad * 2);
  const plotH = Math.max(1, height - pad * 2);

  const minR0 = Math.min(preR0, postR0);
  const maxR0 = Math.max(preR0, postR0);
  const minR1 = Math.min(preR1, postR1);
  const maxR1 = Math.max(preR1, postR1);
  const spanX = Math.max(1, (maxR0 - minR0) * 0.25 || 1);
  const spanY = Math.max(1, (maxR1 - minR1) * 0.25 || 1);
  const xMin = minR0 - spanX;
  const xMax = maxR0 + spanX;
  const yMin = Math.max(0, minR1 - spanY);
  const yMax = maxR1 + spanY;

  const toX = (v: number) => pad + ((v - xMin) / (xMax - xMin)) * plotW;
  const toY = (v: number) => pad + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  // Axes.
  ctx.strokeStyle = '#1f2a44';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, pad + plotH);
  ctx.lineTo(pad + plotW, pad + plotH);
  ctx.stroke();

  // x*y=k hyperbola.
  const k = computeK(preR0, preR1);
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

  // Dashed attack line — from (preR0, preR1) to (postR0, postR1).
  ctx.strokeStyle = state.color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(toX(preR0), toY(preR1));
  ctx.lineTo(toX(postR0), toY(postR1));
  ctx.stroke();
  ctx.setLineDash([]);

  // Pre-attack marker (cyan dot).
  ctx.fillStyle = '#00e5ff';
  ctx.beginPath();
  ctx.arc(toX(preR0), toY(preR1), 4, 0, Math.PI * 2);
  ctx.fill();

  // Attack marker (pulsing red circle).
  if (state.attackSize > 0) {
    const r = 6 + pulse * 6;
    ctx.fillStyle = state.color;
    ctx.beginPath();
    ctx.arc(toX(postR0), toY(postR1), r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Title.
  ctx.fillStyle = '#e6e8ef';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('AMM 机理扰动 (x*y=k)', pad, 14);
}
