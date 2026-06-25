/**
 * Gauge — half-circle (semi-circular) gauge.
 *
 * Renders a 180° arc from left (-π) to right (0) with a fill that
 * grows with `value` mapped to [0, max].  The needle is a line from
 * the centre to the arc edge.
 *
 * The gauge is colour-graded: red below 33%, amber 33-66%, green above.
 */

import type { CanvasSize } from './types';

export interface GaugeOptions {
  /** Current value. */
  value: number;
  /** Max value (default 100).  Anything higher is clamped to max. */
  max?: number;
  /** Label printed below the gauge. */
  label?: string;
}

/** Draw a half-circle gauge. */
export function draw(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  options: GaugeOptions,
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  const max = options.max ?? 100;
  const ratio = Math.max(0, Math.min(1, options.value / max));

  const cx = width / 2;
  const cy = height * 0.85;
  const radius = Math.min(width / 2 - 8, height * 0.75);

  // Background arc.
  ctx.strokeStyle = '#1f2a44';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI, 0);
  ctx.stroke();

  // Filled arc — colour by ratio.
  let color = '#5bd17b';
  if (ratio < 0.33) color = '#ff6b6b';
  else if (ratio < 0.66) color = '#ffb84f';
  ctx.strokeStyle = color;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI, Math.PI + Math.PI * ratio);
  ctx.stroke();

  // Needle.
  const angle = Math.PI + Math.PI * ratio;
  const nx = cx + Math.cos(angle) * (radius - 4);
  const ny = cy + Math.sin(angle) * (radius - 4);
  ctx.strokeStyle = '#e6e8ef';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.stroke();

  // Hub.
  ctx.fillStyle = '#e6e8ef';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();

  // Value text.
  ctx.fillStyle = '#e6e8ef';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(options.value)} / ${max}`, cx, cy - radius * 0.5);
  ctx.textAlign = 'start';

  if (options.label) {
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(options.label, 8, height - 4);
  }
}
