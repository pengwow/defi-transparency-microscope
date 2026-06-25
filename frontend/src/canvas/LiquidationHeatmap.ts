/**
 * LiquidationHeatmap — render a 12x8 grid of "liquidation risk" cells.
 *
 * Each input is {row, col, value} in normalised units (any numeric
 * range; we map min → max → color).  The grid layout is fixed to 12
 * columns × 8 rows (96 cells total) so it always renders the same
 * shape even when the caller supplies only a sparse subset.
 *
 * Colors interpolate cyan (low risk) → amber → coral (high risk).
 */

import type { CanvasSize } from './types';

export interface LiquidationCell {
  row: number;
  col: number;
  value: number;
}

const COLS = 12;
const ROWS = 8;

/** Map a normalised t in [0, 1] to a CSS color from cyan → coral. */
function colorFor(t: number): string {
  const c = Math.max(0, Math.min(1, t));
  // Cyan (#00e5ff) → Amber (#ffab40) → Coral (#ff5e5e)
  if (c < 0.5) {
    const k = c / 0.5;
    const r = Math.round(0 + (255 - 0) * k);
    const g = Math.round(229 + (171 - 229) * k);
    const b = Math.round(255 + (64 - 255) * k);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const k = (c - 0.5) / 0.5;
  const r = Math.round(255 + (255 - 255) * k);
  const g = Math.round(171 + (94 - 171) * k);
  const b = Math.round(64 + (94 - 64) * k);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Draw a 12x8 liquidation risk heatmap. */
export function drawLiquidationHeatmap(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  cells: LiquidationCell[],
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  // Determine value range.
  let min = Infinity;
  let max = -Infinity;
  for (const c of cells) {
    if (c.value < min) min = c.value;
    if (c.value > max) max = c.value;
  }
  if (!isFinite(min) || !isFinite(max)) {
    min = 0;
    max = 1;
  }
  const span = max - min || 1;

  const cellW = width / COLS;
  const cellH = height / ROWS;

  for (const cell of cells) {
    if (cell.row < 0 || cell.row >= ROWS || cell.col < 0 || cell.col >= COLS) continue;
    const t = (cell.value - min) / span;
    ctx.fillStyle = colorFor(t);
    ctx.fillRect(cell.col * cellW, cell.row * cellH, cellW, cellH);
  }
}
