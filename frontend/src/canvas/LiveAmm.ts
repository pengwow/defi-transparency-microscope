/**
 * LiveAmm — real-time AMM price line chart for the live page.
 *
 * Maintains a rolling history of recent price observations (default 50
 * points) starting at 2,456.32.  Each `updatePrice()` tick (or per
 * `drawLiveAmm` frame) perturbs the current price by a small amount
 * and pushes it onto the history, evicting the oldest point.
 *
 * The render paints:
 *   - a cyan stroke poly-line over a gradient-filled area
 *   - the current price as a big readout
 *   - 5 horizontal price-axis ticks
 *   - 5 vertical time-axis ticks
 */

import type { CanvasSize } from './types';

const HISTORY_LEN = 50;
const DEFAULT_PRICE = 2456.32;

let priceHistory: number[] = [];
let livePrice = DEFAULT_PRICE;
// Track the last price we actually pushed into the history, so a
// stream of identical WS ticks doesn't pad the chart with the
// same value and produce a flat line that pretends to be moving.
let lastPushedPrice: number | null = null;

function seedHistory(): void {
  priceHistory = [];
  // Seed a flat history at the default price so the chart has something
  // to render on the very first frame.
  for (let i = 0; i < HISTORY_LEN; i++) {
    priceHistory.push(DEFAULT_PRICE);
  }
  lastPushedPrice = DEFAULT_PRICE;
}

// Initialise the module-level state on import so consumers can read the
// current price before the first draw.
seedHistory();

/** Step the simulated price.  `amount` is the max absolute perturbation
 *  applied uniformly at random; defaults to 2 USD per call. */
export function updatePrice(amount: number = 2): void {
  const delta = (Math.random() * 2 - 1) * amount;
  livePrice = Math.max(1, livePrice + delta);
  priceHistory.push(livePrice);
  lastPushedPrice = livePrice;
  if (priceHistory.length > HISTORY_LEN) {
    priceHistory.shift();
  }
}

/** Push a real price into the chart history.  Repeated values are
 *  deduped so a flat market doesn't pollute the rolling window
 *  with the same point.  Returns true if a new point was added. */
export function setLivePrice(price: number): boolean {
  if (!Number.isFinite(price) || price <= 0) return false;
  if (lastPushedPrice !== null && price === lastPushedPrice) return false;
  livePrice = price;
  priceHistory.push(price);
  lastPushedPrice = price;
  if (priceHistory.length > HISTORY_LEN) {
    priceHistory.shift();
  }
  return true;
}

/** Drop the history and reseed with the default price. */
export function resetLiveAmm(): void {
  livePrice = DEFAULT_PRICE;
  seedHistory();
}

/** Read-only view of the current price (used by the panel ticker). */
export function getLivePrice(): number {
  return livePrice;
}

export interface LiveAmmOpts {
  /** Optional latest price to push BEFORE drawing the frame. */
  tickPrice?: number;
}

export function drawLiveAmm(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  opts: LiveAmmOpts = {},
): void {
  if (opts.tickPrice !== undefined) {
    livePrice = opts.tickPrice;
    priceHistory.push(livePrice);
    if (priceHistory.length > HISTORY_LEN) {
      priceHistory.shift();
    }
  }
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);

  // Background.
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  // Empty-state guard.
  if (priceHistory.length < 2) {
    ctx.fillStyle = '#e6e8ef';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('(no price data)', 10, 20);
    return;
  }

  const padL = 36;
  const padR = 8;
  const padT = 16;
  const padB = 18;
  const plotW = Math.max(1, width - padL - padR);
  const plotH = Math.max(1, height - padT - padB);

  let min = Infinity;
  let max = -Infinity;
  for (const p of priceHistory) {
    if (p < min) min = p;
    if (p > max) max = p;
  }
  if (max === min) {
    max = min + 1;
  }

  const xStep = plotW / (priceHistory.length - 1);
  const yFor = (v: number): number => padT + plotH - ((v - min) / (max - min)) * plotH;

  // Y axis ticks (5).
  ctx.strokeStyle = 'rgba(139,155,180,0.15)';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#8b9bb4';
  ctx.font = '9px system-ui, sans-serif';
  for (let i = 0; i < 5; i++) {
    const y = padT + (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(width - padR, y);
    ctx.stroke();
    const labelV = max - ((max - min) / 4) * i;
    ctx.fillText(labelV.toFixed(2), 2, y + 3);
  }

  // X axis ticks (5).
  for (let i = 0; i < 5; i++) {
    const x = padL + (plotW / 4) * i;
    const t = (i * 4).toString();
    ctx.fillText(t, x - 4, height - 4);
  }

  // Build the polyline path.
  ctx.beginPath();
  for (let i = 0; i < priceHistory.length; i++) {
    const x = padL + i * xStep;
    const y = yFor(priceHistory[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  // Gradient fill under the line.
  const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
  grad.addColorStop(0, 'rgba(0, 229, 255, 0.35)');
  grad.addColorStop(1, 'rgba(0, 229, 255, 0)');
  ctx.fillStyle = grad;
  // Trace the closing edge of the polygon so we can fill it.
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.lineTo(padL, padT + plotH);
  ctx.closePath();
  ctx.fill();

  // Stroke the actual line on top.
  ctx.beginPath();
  for (let i = 0; i < priceHistory.length; i++) {
    const x = padL + i * xStep;
    const y = yFor(priceHistory[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Current price marker.
  const lastX = padL + (priceHistory.length - 1) * xStep;
  const lastY = yFor(priceHistory[priceHistory.length - 1]);
  ctx.fillStyle = '#00e5ff';
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
  ctx.fill();

  // Big price readout in the top-left.
  ctx.fillStyle = '#e6e8ef';
  ctx.font = '14px JetBrains Mono, monospace';
  ctx.fillText(livePrice.toFixed(2), padL, 12);
}
