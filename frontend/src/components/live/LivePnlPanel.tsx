/**
 * LivePnlPanel — 4-bar P&L attribution chart + cumulative PnL readout
 * + four summary metrics (cumulative, fees, IL, gas).
 */

import { useEffect, useState } from 'react';
import { useCanvas } from '@/canvas/useCanvas';
import { drawPnlChart, type PnlBar } from '@/canvas/PnlBarChart';

const BARS: PnlBar[] = [
  { label: 'HODL', value: 1240, color: '#69f0ae' },
  { label: 'LP', value: -340, color: '#ff5e5e' },
  { label: '手续费', value: 95, color: '#00e5ff' },
  { label: '净盈亏', value: 995, color: '#ffab40' },
];

const METRICS: Array<{ key: string; label: string; value: string }> = [
  { key: 'cumulative', label: '累计 PnL', value: '+$995' },
  { key: 'fees', label: '手续费收入', value: '+$95' },
  { key: 'il', label: '无常损失', value: '−$340' },
  { key: 'gas', label: 'Gas 支出', value: '−$48' },
];

export function LivePnlPanel() {
  const { ref } = useCanvas(
    (ctx, size) => {
      drawPnlChart(ctx, size, BARS);
    },
    [],
  );

  const [cumulative, setCumulative] = useState<string>('$0');
  useEffect(() => {
    // Pulse the cumulative number every second.
    const id = setInterval(() => {
      const jitter = Math.floor(Math.random() * 40) - 20;
      const v = 995 + jitter;
      setCumulative(v >= 0 ? `+$${v.toLocaleString()}` : `-$${Math.abs(v).toLocaleString()}`);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="dtm-live-pnl" data-testid="live-pnl">
      <div className="dtm-live-pnl-headline">
        <span className="dtm-live-pnl-headline-label">实时累计 PnL</span>
        <span
          className="dtm-live-pnl-headline-value"
          data-testid="live-pnl-cumulative"
          style={{ color: cumulative.startsWith('+') ? 'var(--dtm-lime)' : 'var(--dtm-coral)' }}
        >
          {cumulative}
        </span>
      </div>
      <canvas ref={ref} className="dtm-viz-canvas" data-testid="live-pnl-canvas" height={140} />
      <div className="dtm-live-pnl-metrics">
        {METRICS.map((m) => (
          <div
            key={m.key}
            className="dtm-live-pnl-metric"
            data-testid={`live-pnl-metric-${m.key}`}
          >
            <div className="dtm-live-pnl-metric-label">{m.label}</div>
            <div className="dtm-live-pnl-metric-value">{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
