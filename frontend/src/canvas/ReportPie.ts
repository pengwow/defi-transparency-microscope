/**
 * ReportPie — 5-segment pie chart of MEV strategy attribution.
 *
 * Each slice occupies an angular share proportional to its value,
 * with a small donut hole in the middle for the legend.  A label
 * and a percent tag are drawn next to each slice.
 */

import type { CanvasSize } from './types';

export interface ReportPieSlice {
  label: string;
  value: number;
  color: string;
}

/** Draw the strategy-attribution pie chart. */
export function drawReportPie(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  slices: ReadonlyArray<ReportPieSlice>,
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  const total = slices.reduce((acc, s) => acc + Math.max(0, s.value), 0);
  if (slices.length === 0 || total <= 0) {
    ctx.fillStyle = '#e6e8ef';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('(no strategy data)', 10, 20);
    return;
  }

  const cx = height / 2;
  const cy = height / 2;
  const radius = Math.min(height / 2 - 8, height * 0.45);
  const innerRadius = radius * 0.45;

  let startAngle = -Math.PI / 2; // start at 12 o'clock
  for (const slice of slices) {
    const sweep = (Math.max(0, slice.value) / total) * Math.PI * 2;
    const endAngle = startAngle + sweep;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();

    // inner cut-out to make it a donut
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // label on the right-hand side, outside the donut
    const midAngle = (startAngle + endAngle) / 2;
    const labelX = cx + (radius + 14) * Math.cos(midAngle);
    const labelY = cy + (radius + 14) * Math.sin(midAngle);
    const pct = ((slice.value / total) * 100).toFixed(0);
    ctx.fillStyle = slice.color;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${slice.label} ${pct}%`, labelX, labelY);

    startAngle = endAngle;
  }
}
