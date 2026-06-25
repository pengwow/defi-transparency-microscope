/**
 * AmmCurve — visualize a constant-product (x*y=k) AMM pool.
 *
 * Renders the hyperbola defined by the current reserves, plus a trail of
 * past (reserve0, reserve1) pairs that show how the curve has migrated
 * across observed transactions.  Each historical point is marked as a
 * dot whose colour encodes whether the transaction was a buy of token0
 * (red) or a buy of token1 (green).
 *
 * All amounts are normalised to chart coordinates in `draw()`; the raw
 * bigint reserves are converted to floats in plot space.
 */

import type { CanvasSize } from './types';
import type { Pool, Transaction } from '@/types';
import { getAmountOut } from '@/algorithms/cpmm';

/** A single historic point to render on the curve. */
interface CurvePoint {
  /** Normalised x in [0, 1]. */
  x: number;
  /** Normalised y in [0, 1]. */
  y: number;
  /** 'buy0' for token0-in trades, 'buy1' for token1-in trades. */
  kind: 'buy0' | 'buy1';
}

/**
 * Reduce a pool to a list of historical reserve pairs by replaying each
 * transaction in order.  Returns the points plus the final reserves.
 */
function replayReserves(
  pool: Pool,
  txs: Transaction[],
): { reserve0: bigint; reserve1: bigint; points: CurvePoint[] } {
  let r0 = pool.reserve0;
  let r1 = pool.reserve1;
  const points: CurvePoint[] = [];

  // Walk all swaps touching this pool, recording (r0, r1) after each.
  for (const tx of txs) {
    if (tx.type !== 'swap' || !tx.swaps) continue;
    for (const hop of tx.swaps) {
      if (hop.pool.toLowerCase() !== pool.address.toLowerCase()) continue;
      const isToken0In =
        hop.tokenIn.toLowerCase() === pool.token0.address.toLowerCase();
      if (isToken0In) {
        if (r0 <= 0n || r1 <= 0n) continue;
        const out = getAmountOut(hop.amountIn, r0, r1);
        r0 = r0 + hop.amountIn;
        r1 = r1 - out;
        points.push({ x: 0, y: 0, kind: 'buy0' });
      } else {
        if (r0 <= 0n || r1 <= 0n) continue;
        const out = getAmountOut(hop.amountIn, r1, r0);
        r1 = r1 + hop.amountIn;
        r0 = r0 - out;
        points.push({ x: 0, y: 0, kind: 'buy1' });
      }
    }
  }

  // Determine bounds from observed reserves.
  const xs: number[] = [Number(pool.reserve0), Number(r0)];
  const ys: number[] = [Number(pool.reserve1), Number(r1)];
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const sx = (v: bigint) => (xMax === xMin ? 0.5 : (Number(v) - xMin) / (xMax - xMin));
  const sy = (v: bigint) => (yMax === yMin ? 0.5 : (Number(v) - yMin) / (yMax - yMin));

  // Replay *again* to stamp each point with its post-trade position.
  let r0c = pool.reserve0;
  let r1c = pool.reserve1;
  let idx = 0;
  for (const tx of txs) {
    if (tx.type !== 'swap' || !tx.swaps) continue;
    for (const hop of tx.swaps) {
      if (hop.pool.toLowerCase() !== pool.address.toLowerCase()) continue;
      const isToken0In =
        hop.tokenIn.toLowerCase() === pool.token0.address.toLowerCase();
      if (isToken0In) {
        const out = getAmountOut(hop.amountIn, r0c, r1c);
        r0c = r0c + hop.amountIn;
        r1c = r1c - out;
      } else {
        const out = getAmountOut(hop.amountIn, r1c, r0c);
        r1c = r1c + hop.amountIn;
        r0c = r0c - out;
      }
      if (idx < points.length) {
        points[idx] = {
          x: sx(r0c),
          y: sy(r1c),
          kind: isToken0In ? 'buy0' : 'buy1',
        };
        idx++;
      }
    }
  }

  return { reserve0: r0, reserve1: r1, points };
}

/** Compute the k=xy constant.  Used to draw the hyperbola. */
function computeK(r0: bigint, r1: bigint): number {
  return Number(r0) * Number(r1);
}

/** Draw the AmmCurve chart. */
export function draw(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  pool: Pool,
  transactions: Transaction[],
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  const pad = 24;
  const plotW = Math.max(1, width - pad * 2);
  const plotH = Math.max(1, height - pad * 2);

  // Replay reserves to find x/y bounds and the trail.
  const { reserve0, reserve1, points } = replayReserves(pool, transactions);

  // Compute axis ranges.
  const minR0 = pool.reserve0 < reserve0 ? pool.reserve0 : reserve0;
  const maxR0 = pool.reserve0 > reserve0 ? pool.reserve0 : reserve0;
  const minR1 = pool.reserve1 < reserve1 ? pool.reserve1 : reserve1;
  const maxR1 = pool.reserve1 > reserve1 ? pool.reserve1 : reserve1;
  // Add 10% padding so the curve doesn't touch the edges.
  const spanX = Math.max(1, Number(maxR0 - minR0));
  const spanY = Math.max(1, Number(maxR1 - minR1));
  const xMin = Number(minR0) - spanX * 0.1;
  const xMax = Number(maxR0) + spanX * 0.1;
  const yMin = Number(minR1) - spanY * 0.1;
  const yMax = Number(maxR1) + spanY * 0.1;

  const toX = (v: number) => pad + ((v - xMin) / (xMax - xMin)) * plotW;
  // Y axis is inverted: low y (small reserve) at the bottom.
  const toY = (v: number) => pad + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  // Draw axes.
  ctx.strokeStyle = '#1f2a44';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, pad + plotH);
  ctx.lineTo(pad + plotW, pad + plotH);
  ctx.stroke();

  // Draw the x*y=k hyperbola.
  const k = computeK(pool.reserve0, pool.reserve1);
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

  // Draw historic points.
  for (const p of points) {
    const px = pad + p.x * plotW;
    const py = pad + (1 - p.y) * plotH;
    ctx.fillStyle = p.kind === 'buy0' ? '#ff6b6b' : '#5bd17b';
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw current reserves marker.
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(toX(Number(reserve0)), toY(Number(reserve1)), 5, 0, Math.PI * 2);
  ctx.fill();

  // Title.
  ctx.fillStyle = '#e6e8ef';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`x*y=k  ${pool.token0.symbol}/${pool.token1.symbol}`, pad, 14);
}
