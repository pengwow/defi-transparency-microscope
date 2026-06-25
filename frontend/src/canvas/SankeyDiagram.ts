/**
 * SankeyDiagram — visualize a single value flow as a curved ribbon.
 *
 * The MVP flow is intentionally simple: one source node on the left,
 * one or more target nodes on the right, with bezier ribbons whose
 * thickness encodes the share of the total flow.  The input is a
 * {source, targets[]} object where each target has a label and a
 * non-negative value.
 */

import type { CanvasSize } from './types';

export interface SankeyNode {
  label: string;
}

export interface SankeyFlow {
  source: SankeyNode;
  /** Targets with their share of the flow (raw value, will be normalised). */
  targets: Array<{ node: SankeyNode; value: number }>;
}

/** Draw a sankey-style flow chart. */
export function draw(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  flow: SankeyFlow,
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  if (flow.targets.length === 0) {
    ctx.fillStyle = '#e6e8ef';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('(no flow data)', 10, 20);
    return;
  }

  const pad = 16;
  const sourceX = pad;
  const sourceW = 12;
  const targetX = width - pad - sourceW;
  const total = flow.targets.reduce((s, t) => s + Math.max(0, t.value), 0);
  if (total <= 0) return;

  const sourceY = pad;
  const sourceH = height - pad * 2;

  // Source node (vertical bar).
  ctx.fillStyle = '#4f8cff';
  ctx.fillRect(sourceX, sourceY, sourceW, sourceH);

  // Source label.
  ctx.fillStyle = '#e6e8ef';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(flow.source.label, sourceX, sourceY - 4);

  // Compute target heights and y positions.
  const gap = 4;
  const totalGaps = gap * (flow.targets.length - 1);
  const usable = height - pad * 2 - totalGaps;
  let cursorY = pad;
  const ribbons: Array<{ y: number; h: number; value: number; label: string }> = [];
  for (const t of flow.targets) {
    const h = (Math.max(0, t.value) / total) * usable;
    ribbons.push({ y: cursorY, h, value: t.value, label: t.node.label });
    cursorY += h + gap;
  }

  // Draw ribbons.
  const colors = ['#4f8cff', '#5bd17b', '#ffb84f', '#ff6b6b', '#b86bff', '#4fd1c5'];
  for (let i = 0; i < ribbons.length; i++) {
    const r = ribbons[i];
    const color = colors[i % colors.length];
    // Build a bezier ribbon from source column to target column.
    const sx = sourceX + sourceW;
    const tx = targetX;
    const cp = (tx - sx) / 2;

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.moveTo(sx, sourceY + (r.y - pad) / sourceH * sourceH);
    // top edge
    ctx.bezierCurveTo(sx + cp, sourceY + (r.y - pad) / sourceH * sourceH, tx - cp, r.y, tx, r.y);
    // right edge
    ctx.lineTo(tx, r.y + r.h);
    // bottom edge
    ctx.bezierCurveTo(
      tx - cp,
      r.y + r.h,
      sx + cp,
      sourceY + ((r.y + r.h - pad) / sourceH) * sourceH,
      sx,
      sourceY + ((r.y + r.h - pad) / sourceH) * sourceH,
    );
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Target node.
    ctx.fillStyle = color;
    ctx.fillRect(targetX, r.y, sourceW, r.h);

    // Target label.
    ctx.fillStyle = '#e6e8ef';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(r.label, targetX + sourceW + 4, r.y + r.h / 2 + 3);
  }
}
