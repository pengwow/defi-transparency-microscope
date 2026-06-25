/**
 * ReportWaterfall — 6-step profit waterfall for the Report page.
 *
 *   1. 攻击者利润 (searcher profit)
 *   2. 受害者损失 (victim loss)
 *   3. LP 损失 (LP loss)
 *   4. 协议费 (protocol fee)
 *   5. 验证者小费 (validator tip)
 *   6. 净效果 (net effect — total)
 *
 * Each step is rendered as a `fillRect` whose colour depends on
 * the step type:
 *   - 'gain'  → cyan
 *   - 'loss'  → coral
 *   - 'total' → amber
 *
 * Bars are positioned according to the running cumulative total,
 * which is what makes the chart a "waterfall" (each bar starts
 * where the previous one ended).
 */

import type { CanvasSize } from './types';

export interface ReportWaterfallStep {
  label: string;
  delta: number;
  type: 'gain' | 'loss' | 'total';
}

const COLOR: Record<ReportWaterfallStep['type'], string> = {
  gain: '#00e5ff',
  loss: '#ff5e5e',
  total: '#ffab40',
};

/** Draw the profit-waterfall chart. */
export function drawReportWaterfall(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  steps: ReadonlyArray<ReportWaterfallStep>,
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  if (steps.length === 0) {
    ctx.fillStyle = '#e6e8ef';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('(no waterfall data)', 10, 20);
    return;
  }

  const pad = 28;
  const plotW = Math.max(1, width - pad * 2);
  const plotH = Math.max(1, height - pad * 2 - 16);

  // Compute running totals to find min/max for the Y axis.
  let running = 0;
  let yMin = 0;
  let yMax = 0;
  const cum: number[] = [];
  for (const s of steps) {
    if (s.type === 'total') {
      cum.push(s.delta);
      running = s.delta;
    } else {
      const start = running;
      const end = running + s.delta;
      cum.push(start);
      running = end;
    }
    if (running < yMin) yMin = running;
    if (running > yMax) yMax = running;
  }
  if (yMin === yMax) yMax = yMin + 1;
  const yRange = yMax - yMin;

  const toY = (v: number) => pad + (1 - (v - yMin) / yRange) * plotH;

  // Zero baseline.
  ctx.strokeStyle = '#4a5878';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  const zeroY = toY(0);
  ctx.moveTo(pad, zeroY);
  ctx.lineTo(pad + plotW, zeroY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Bars.
  const barW = (plotW / steps.length) * 0.7;
  const gap = (plotW - barW * steps.length) / Math.max(1, steps.length + 1);
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const start = cum[i];
    const end = s.type === 'total' ? 0 : start + s.delta;
    const yTop = toY(Math.max(start, end));
    const yBot = toY(Math.min(start, end));
    const x = pad + gap + i * (barW + gap);

    ctx.fillStyle = COLOR[s.type];
    ctx.fillRect(x, yTop, barW, yBot - yTop);

    // Connector line to the next step.
    if (i < steps.length - 1) {
      ctx.strokeStyle = '#4a5878';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x + barW, yBot);
      ctx.lineTo(x + barW + gap, yBot);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Label below.
    ctx.fillStyle = '#e6e8ef';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.label, x + barW / 2, pad + plotH + 12);
  }
}
