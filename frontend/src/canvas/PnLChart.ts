/**
 * PnLChart — simple bar chart of P&L values (one bar per entry).
 *
 * Positive bars are green, negative bars are red.  A horizontal line
 * marks y=0.  Each bar may have an optional label rendered below the
 * axis (clipped to the canvas width).
 */

import type { CanvasSize } from './types';

export interface PnLPoint {
  label?: string;
  value: number;
}

/** Draw a P&L bar chart. */
export function draw(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  points: PnLPoint[],
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  if (points.length === 0) {
    ctx.fillStyle = '#e6e8ef';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('(no P&L data)', 10, 20);
    return;
  }

  const pad = 24;
  const plotW = Math.max(1, width - pad * 2);
  const plotH = Math.max(1, height - pad * 2);

  let maxAbs = 0;
  for (const p of points) {
    if (Math.abs(p.value) > maxAbs) maxAbs = Math.abs(p.value);
  }
  if (maxAbs === 0) maxAbs = 1;

  const baselineY = pad + plotH / 2;
  const barW = Math.max(2, (plotW / points.length) * 0.7);
  const gap = (plotW - barW * points.length) / Math.max(1, points.length + 1);

  // Axes.
  ctx.strokeStyle = '#1f2a44';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, pad + plotH);
  ctx.lineTo(pad + plotW, pad + plotH);
  ctx.stroke();

  // Zero line.
  ctx.strokeStyle = '#4a5878';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(pad, baselineY);
  ctx.lineTo(pad + plotW, baselineY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Bars.
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const x = pad + gap + i * (barW + gap);
    const h = (Math.abs(p.value) / maxAbs) * (plotH / 2);
    const y = p.value >= 0 ? baselineY - h : baselineY;
    ctx.fillStyle = p.value >= 0 ? '#5bd17b' : '#ff6b6b';
    ctx.fillRect(x, y, barW, h);

    if (p.label && barW > 14) {
      ctx.fillStyle = '#e6e8ef';
      ctx.font = '9px system-ui, sans-serif';
      ctx.save();
      ctx.translate(x + barW / 2, pad + plotH + 8);
      ctx.rotate(Math.PI / 4);
      ctx.fillText(p.label, 0, 0);
      ctx.restore();
    }
  }
}
