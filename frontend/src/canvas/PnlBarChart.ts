/**
 * PnlBarChart — small 4-bar attribution chart used on the live page
 * (HODL / LP / 手续费 / 净盈亏).
 *
 * Each bar uses the caller-supplied `color`.  A numeric label is drawn
 * on top of every bar; the bottom of the chart shows the bar's label.
 */

import type { CanvasSize } from './types';

export interface PnlBar {
  label: string;
  value: number;
  color: string;
}

export function drawPnlChart(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  data: PnlBar[],
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  if (data.length === 0) {
    ctx.fillStyle = '#e6e8ef';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('(no P&L data)', 10, 20);
    return;
  }

  const padL = 12;
  const padR = 12;
  const padT = 24;
  const padB = 28;
  const plotW = Math.max(1, width - padL - padR);
  const plotH = Math.max(1, height - padT - padB);

  // Normalize across the dataset's absolute value range.
  let maxAbs = 0;
  for (const d of data) {
    if (Math.abs(d.value) > maxAbs) maxAbs = Math.abs(d.value);
  }
  if (maxAbs === 0) maxAbs = 1;

  const barSlot = plotW / data.length;
  const barW = Math.max(4, barSlot * 0.55);
  const baselineY = padT + plotH * 0.5; // zero-line lives in the middle

  // Half-height range, allowing bars to extend up or down.
  const halfH = plotH * 0.5;

  data.forEach((d, i) => {
    const cx = padL + barSlot * i + barSlot / 2;
    const x = cx - barW / 2;
    const h = (Math.abs(d.value) / maxAbs) * halfH;
    const y = d.value >= 0 ? baselineY - h : baselineY;

    ctx.fillStyle = d.color;
    ctx.fillRect(x, y, barW, h);

    // Value label on top of the bar.
    ctx.fillStyle = '#e6e8ef';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    const labelY = d.value >= 0 ? y - 4 : y + h + 12;
    ctx.fillText(formatValue(d.value), cx, labelY);
    ctx.textAlign = 'start';

    // Category label below the bar.
    ctx.fillStyle = '#8b9bb4';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.label, cx, height - 10);
    ctx.textAlign = 'start';
  });

  // Zero baseline.
  ctx.strokeStyle = 'rgba(139,155,180,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, baselineY);
  ctx.lineTo(width - padR, baselineY);
  ctx.stroke();
}

function formatValue(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return v.toFixed(0);
}
