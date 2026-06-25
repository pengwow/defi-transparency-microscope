/**
 * HfGauge — half-arc (semi-circular) gauge for a single position's
 * Health Factor (HF).
 *
 * Visual: a 180° arc (left → right), a colored fill proportional to
 * the current value, a needle pointing at the value, and the numeric
 * value rendered in the centre.
 *
 * The stroke color is tied to the `level` prop:
 *   - 'safe'       → lime   (#69f0ae)
 *   - 'warning'    → amber  (#ffab40)
 *   - 'danger'     → coral  (#ff5e5e)
 *   - 'liquidated' → muted  (#5a6a82)
 */

import type { CanvasSize } from './types';

export type HfLevel = 'safe' | 'warning' | 'danger' | 'liquidated';

export interface HfGaugeState {
  /** Current HF (>= 0). */
  value: number;
  /** Max value used for the scale (default 3). */
  max: number;
  /** Tint level — controls the fill / needle color. */
  level: HfLevel;
}

export interface HfGaugeOptions {
  /** Pulse phase in [0, 1] for the danger level (drives the needle width). */
  pulse?: number;
}

const LEVEL_COLOR: Record<HfLevel, string> = {
  safe: '#69f0ae',
  warning: '#ffab40',
  danger: '#ff5e5e',
  liquidated: '#5a6a82',
};

const DEFAULT_STATE: HfGaugeState = { value: 1.5, max: 3, level: 'safe' };

let state: HfGaugeState = { ...DEFAULT_STATE };

/** Replace the gauge state. */
export function setHfGauge(next: Partial<HfGaugeState>): void {
  state = { ...state, ...next };
}

/** Read-only view of the current state. */
export function getHfGauge(): HfGaugeState {
  return state;
}

/** Draw the HF semi-arc gauge. */
export function drawHfGauge(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  _options: HfGaugeOptions,
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  const max = state.max > 0 ? state.max : 3;
  const ratio = Math.max(0, Math.min(1, state.value / max));
  const color = LEVEL_COLOR[state.level] ?? LEVEL_COLOR.safe;

  const cx = width / 2;
  const cy = height * 0.88;
  const radius = Math.min(width / 2 - 14, height * 0.7);

  // Background arc.
  ctx.strokeStyle = '#1f2a44';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI, 0);
  ctx.stroke();

  // Filled arc.
  ctx.strokeStyle = color;
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI, Math.PI + Math.PI * ratio);
  ctx.stroke();

  // Needle.
  const angle = Math.PI + Math.PI * ratio;
  const nx = cx + Math.cos(angle) * (radius - 6);
  const ny = cy + Math.sin(angle) * (radius - 6);
  ctx.strokeStyle = '#e6e8ef';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.stroke();

  // Hub.
  ctx.fillStyle = '#e6e8ef';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();

  // Centre value.
  ctx.fillStyle = color;
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(state.value.toFixed(2), cx, cy - radius * 0.55);

  // Level label.
  ctx.fillStyle = '#8b9bb4';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(state.level.toUpperCase(), cx, cy - radius * 0.25);
  ctx.textAlign = 'start';
}
