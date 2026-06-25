/**
 * Heatmap — render a 2-D matrix as a grid of colored cells.
 *
 * The matrix is an array of rows.  Values are normalised to [0, 1]
 * using the global min/max, then mapped to a color via a small HSL
 * gradient (blue → cyan → green → yellow → red).
 */

import type { CanvasSize } from './types';

export type HeatmapMatrix = number[][];

/** Map a normalised t in [0, 1] to a HSL color. */
function colorFor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  // 240° (blue) at 0 → 0° (red) at 1.
  const hue = 240 - clamped * 240;
  return `hsl(${hue}, 75%, 55%)`;
}

/** Draw a heatmap. */
export function draw(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  matrix: HeatmapMatrix,
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  const rows = matrix.length;
  if (rows === 0 || matrix[0].length === 0) {
    ctx.fillStyle = '#e6e8ef';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('(empty matrix)', 10, 20);
    return;
  }
  const cols = matrix[0].length;

  // Global min/max.
  let min = Infinity;
  let max = -Infinity;
  for (const row of matrix) {
    for (const v of row) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const span = max - min || 1;

  const cellW = width / cols;
  const cellH = height / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = matrix[r][c];
      const t = (v - min) / span;
      ctx.fillStyle = colorFor(t);
      ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
    }
  }

  // Title.
  ctx.fillStyle = '#e6e8ef';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(`range: [${min.toFixed(2)}, ${max.toFixed(2)}]`, 4, height - 4);
}
