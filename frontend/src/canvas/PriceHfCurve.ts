/**
 * PriceHfCurve — line chart of Health Factor vs ETH price.
 *
 * X axis: ETH price in USD.
 * Y axis: Health Factor (clamped to [0.5, max]).
 *
 * The HF=1 line is rendered as a dashed coral threshold; the curve
 * itself is drawn in cyan, with the portion that crosses below HF=1
 * tinted coral to make the danger zone obvious.
 */

import type { CanvasSize } from './types';

export interface PriceHfPoint {
  /** ETH price in USD. */
  price: number;
  /** Health Factor at that price. */
  hf: number;
}

const Y_MIN = 0.5;

/** Draw the price vs HF curve. */
export function drawPriceHfCurve(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  data: PriceHfPoint[],
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  const pad = 28;
  const plotW = Math.max(1, width - pad * 2);
  const plotH = Math.max(1, height - pad * 2);

  if (data.length === 0) {
    ctx.fillStyle = '#8b9bb4';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('(empty)', pad, pad + 14);
    return;
  }

  // Determine bounds.
  let pMin = Infinity;
  let pMax = -Infinity;
  let hfMax = 1.5;
  for (const d of data) {
    if (d.price < pMin) pMin = d.price;
    if (d.price > pMax) pMax = d.price;
    if (d.hf > hfMax) hfMax = d.hf;
  }
  if (pMax === pMin) {
    pMax = pMin + 1;
  }
  const yMax = hfMax;
  const yMin = Y_MIN;

  const toX = (p: number) => pad + ((p - pMin) / (pMax - pMin)) * plotW;
  const toY = (hf: number) => {
    const t = Math.max(0, Math.min(1, (hf - yMin) / (yMax - yMin)));
    return pad + (1 - t) * plotH;
  };

  // Axes.
  ctx.strokeStyle = '#1f2a44';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, pad + plotH);
  ctx.lineTo(pad + plotW, pad + plotH);
  ctx.stroke();

  // Threshold line at HF=1.
  ctx.strokeStyle = '#ff5e5e';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  const ty = toY(1);
  ctx.moveTo(pad, ty);
  ctx.lineTo(pad + plotW, ty);
  ctx.stroke();
  ctx.setLineDash([]);

  // Curve.
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const x = toX(d.price);
    const y = toY(d.hf);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Dots.
  for (const d of data) {
    ctx.fillStyle = d.hf < 1 ? '#ff5e5e' : '#00e5ff';
    ctx.beginPath();
    ctx.arc(toX(d.price), toY(d.hf), 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Threshold label.
  ctx.fillStyle = '#ff5e5e';
  ctx.font = '10px system-ui, sans-serif';
  ctx.fillText('HF=1 警戒线', pad + 4, ty - 4);

  // Title.
  ctx.fillStyle = '#e6e8ef';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('ETH 价格 vs HF', pad, pad - 8);
}
