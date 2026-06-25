/**
 * ReportRadar — 5-axis radar chart of MEV risk dimensions.
 *
 *   1. Background pentagon (5-sided polygon) for the outer frame.
 *   2. Two inner concentric grid pentagons (40%, 70%).
 *   3. One filled data polygon for the actual risk values.
 *   4. Axis labels rendered at each vertex.
 */

import type { CanvasSize } from './types';

export interface ReportRadarAxis {
  label: string;
  value: number;
  max: number;
}

const GRID_RATIOS = [0.35, 0.7, 1];

/** Draw the risk-assessment radar chart. */
export function drawReportRadar(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  axes: ReadonlyArray<ReportRadarAxis>,
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  if (axes.length === 0) {
    ctx.fillStyle = '#e6e8ef';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('(no risk data)', 10, 20);
    return;
  }

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 28;
  const n = axes.length;
  // Start at the top (12 o'clock) and go clockwise.
  const angleFor = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;

  const pointFor = (i: number, r: number) => ({
    x: cx + r * Math.cos(angleFor(i)),
    y: cy + r * Math.sin(angleFor(i)),
  });

  // Grid pentagons (concentric).
  for (const ratio of GRID_RATIOS) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = pointFor(i, radius * ratio);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = ratio === 1 ? '#4a5878' : '#1f2a44';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Spokes from center to each vertex.
  for (let i = 0; i < n; i++) {
    const p = pointFor(i, radius);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = '#1f2a44';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Data polygon.
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const axis = axes[i];
    const r = (Math.max(0, Math.min(axis.value, axis.max)) / axis.max) * radius;
    const p = pointFor(i, r);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(0, 229, 255, 0.22)';
  ctx.fill();
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Axis labels.
  ctx.fillStyle = '#e6e8ef';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    const axis = axes[i];
    const p = pointFor(i, radius + 16);
    ctx.fillText(axis.label, p.x, p.y);
  }
}
