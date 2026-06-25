/**
 * ForkSankey — visualise how value flows from a single LP pool to its
 * recipients in a sandwich attack.
 *
 * The input is a list of { from, to, amount, color } flow descriptors.
 * The renderer aggregates flows by `to` and draws:
 *   - one source node on the left (the LP pool),
 *   - one target node per unique `to` value on the right, sized
 *     proportionally to the sum of incoming amounts,
 *   - a quadratic-bezier ribbon connecting the source column to each
 *     target, shaded with the flow's color.
 *
 * Unlike the existing SankeyDiagram, this module takes a flat list of
 * flows (not a `SankeyFlow` object with nested targets) so callers
 * can pass rows directly from a sandbox experiment result.
 */

import type { CanvasSize } from './types';

export interface ForkSankeyFlow {
  from: string;
  to: string;
  /** Positive numeric amount (will be normalised by max). */
  amount: number;
  /** Color used for both the target node and its ribbon. */
  color: string;
}

interface TargetAggregate {
  to: string;
  amount: number;
  color: string;
}

function aggregate(flows: ForkSankeyFlow[]): TargetAggregate[] {
  const byKey = new Map<string, TargetAggregate>();
  for (const f of flows) {
    if (f.amount <= 0) continue;
    const existing = byKey.get(f.to);
    if (existing) {
      existing.amount += f.amount;
    } else {
      byKey.set(f.to, { to: f.to, amount: f.amount, color: f.color });
    }
  }
  return Array.from(byKey.values());
}

/** Draw the fork sankey chart. */
export function drawForkSankey(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  flows: ForkSankeyFlow[],
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  if (flows.length === 0) {
    ctx.fillStyle = '#e6e8ef';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('(no flow data)', 10, 20);
    return;
  }

  const targets = aggregate(flows);
  if (targets.length === 0) return;

  // All flows share the same source — infer from the first row.
  const sourceLabel = flows[0].from;

  const pad = 16;
  const sourceX = pad;
  const sourceW = 12;
  const targetX = width - pad - sourceW;
  const sourceY = pad;
  const sourceH = height - pad * 2;
  const total = targets.reduce((s, t) => s + t.amount, 0);
  if (total <= 0) return;

  // Source node.
  ctx.fillStyle = '#4f8cff';
  ctx.fillRect(sourceX, sourceY, sourceW, sourceH);

  // Source label.
  ctx.fillStyle = '#e6e8ef';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(sourceLabel, sourceX, sourceY - 4);

  // Target node heights.
  const gap = 6;
  const totalGaps = gap * (targets.length - 1);
  const usable = Math.max(1, sourceH - totalGaps);
  let cursorY = sourceY;
  const ribbons: Array<{ y: number; h: number; t: TargetAggregate }> = [];
  for (const t of targets) {
    const h = Math.max(2, (t.amount / total) * usable);
    ribbons.push({ y: cursorY, h, t });
    cursorY += h + gap;
  }

  // Draw ribbons.
  for (const r of ribbons) {
    const sx = sourceX + sourceW;
    const tx = targetX;
    const cp = (tx - sx) / 2;
    const srcTopRatio = (r.y - sourceY) / sourceH;
    const srcBotRatio = (r.y + r.h - sourceY) / sourceH;
    const srcTopY = sourceY + srcTopRatio * sourceH;
    const srcBotY = sourceY + srcBotRatio * sourceH;

    ctx.fillStyle = r.t.color;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(sx, srcTopY);
    ctx.bezierCurveTo(sx + cp, srcTopY, tx - cp, r.y, tx, r.y);
    ctx.lineTo(tx, r.y + r.h);
    ctx.bezierCurveTo(tx - cp, r.y + r.h, sx + cp, srcBotY, sx, srcBotY);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Target node.
    ctx.fillStyle = r.t.color;
    ctx.fillRect(targetX, r.y, sourceW, r.h);

    // Target label + amount.
    ctx.fillStyle = '#e6e8ef';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(r.t.to, targetX + sourceW + 4, r.y + r.h / 2 - 1);
    ctx.fillStyle = '#8b9bb4';
    ctx.font = '9px system-ui, sans-serif';
    ctx.fillText(`$${r.t.amount.toFixed(0)}`, targetX + sourceW + 4, r.y + r.h / 2 + 9);
  }
}
