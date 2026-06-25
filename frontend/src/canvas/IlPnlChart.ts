/**
 * IlPnlChart — grouped-bar chart comparing V2 vs V3 P&L for a fixed
 * set of price-ratio scenarios (e.g. 0.5x, 1x, 2x, 5x).
 *
 * For each `data[i]` (one scenario) we draw two adjacent bars:
 *   - the V2 P&L in the amber accent
 *   - the V3 P&L in the cyan accent
 *
 * The Y axis spans the data's `min..max` so that small and large
 * scenarios remain comparable.  A horizontal zero line is drawn.
 */

import type { CanvasSize } from './types';

export interface IlPnlData {
  /** Scenario label, e.g. "0.5x" / "1x" / "2x" / "5x". */
  label: string;
  /** V2 P&L value (positive or negative). */
  v2: number;
  /** V3 P&L value (positive or negative). */
  v3: number;
}

const COLOR_BG = '#0b1020';
const COLOR_V2 = '#ffab40'; // amber (V2)
const COLOR_V3 = '#00e5ff'; // cyan  (V3)
const COLOR_GRID = 'rgba(139, 155, 180, 0.18)';
const COLOR_AXIS = 'rgba(139, 155, 180, 0.4)';
const COLOR_TEXT = '#e6e8ef';
const COLOR_LABEL = '#8b9bb4';

export function drawIlPnlChart(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  data: IlPnlData[],
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, width, height);

  if (data.length === 0) {
    ctx.fillStyle = COLOR_TEXT;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('(no P&L data)', 10, 20);
    return;
  }

  const padL = 16;
  const padR = 16;
  const padT = 28;
  const padB = 32;
  const plotW = Math.max(1, width - padL - padR);
  const plotH = Math.max(1, height - padT - padB);

  // Y-axis range from data min/max (with a small headroom).
  let minV = 0;
  let maxV = 0;
  for (const d of data) {
    if (d.v2 < minV) minV = d.v2;
    if (d.v3 < minV) minV = d.v3;
    if (d.v2 > maxV) maxV = d.v2;
    if (d.v3 > maxV) maxV = d.v3;
  }
  const range = maxV - minV;
  const headroom = range === 0 ? Math.max(1, Math.abs(maxV) * 0.2) : range * 0.1;
  const yMin = minV - headroom;
  const yMax = maxV + headroom;
  const ySpan = Math.max(1e-9, yMax - yMin);

  // Title.
  ctx.fillStyle = COLOR_TEXT;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('V2 vs V3 P&L (grouped bars)', padL, 14);

  // Y mapping.
  const toY = (v: number) => padT + ((yMax - v) / ySpan) * plotH;
  const zeroY = toY(0);

  // Zero line.
  ctx.strokeStyle = COLOR_AXIS;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, zeroY);
  ctx.lineTo(width - padR, zeroY);
  ctx.stroke();

  // Group geometry.
  const groupSlot = plotW / data.length;
  const groupPad = Math.max(4, groupSlot * 0.15);
  const innerW = groupSlot - groupPad * 2;
  const barW = innerW / 2 - 2; // two bars per group with 4px gap

  // Light grid lines (2 horizontal grid lines).
  ctx.strokeStyle = COLOR_GRID;
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = padT + (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(width - padR, y);
    ctx.stroke();
  }

  data.forEach((d, i) => {
    const groupX = padL + groupSlot * i;
    const xV2 = groupX + groupPad;
    const xV3 = xV2 + barW + 4;

    const yV2 = toY(d.v2);
    const yV3 = toY(d.v3);
    const v2H = Math.abs(zeroY - yV2);
    const v3H = Math.abs(zeroY - yV3);
    const v2Top = d.v2 >= 0 ? yV2 : zeroY;
    const v3Top = d.v3 >= 0 ? yV3 : zeroY;

    // V2 bar.
    ctx.fillStyle = COLOR_V2;
    ctx.fillRect(xV2, v2Top, barW, v2H);

    // V3 bar.
    ctx.fillStyle = COLOR_V3;
    ctx.fillRect(xV3, v3Top, barW, v3H);

    // Numeric labels above each bar.
    ctx.fillStyle = COLOR_TEXT;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    const v2LabelY = d.v2 >= 0 ? v2Top - 4 : v2Top + v2H + 12;
    const v3LabelY = d.v3 >= 0 ? v3Top - 4 : v3Top + v3H + 12;
    ctx.fillText(formatValue(d.v2), xV2 + barW / 2, v2LabelY);
    ctx.fillText(formatValue(d.v3), xV3 + barW / 2, v3LabelY);

    // Group label below.
    ctx.fillStyle = COLOR_LABEL;
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(d.label, groupX + groupSlot / 2, height - 12);
  });

  ctx.textAlign = 'start';
}

function formatValue(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000) return (v / 1_000).toFixed(1) + 'K';
  return v.toFixed(0);
}
