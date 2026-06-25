/**
 * MetricBox — single labelled value tile with optional trend indicator.
 *
 *   <MetricBox label="MEV Cost" value="$4.2K" trend="up" />
 */

import type { CSSProperties, ReactNode } from 'react';

export type MetricTrend = 'up' | 'down' | 'flat';

export interface MetricBoxProps {
  label: ReactNode;
  value: ReactNode;
  /** Optional trend indicator (arrow + color hint). */
  trend?: MetricTrend;
  testId?: string;
  style?: CSSProperties;
}

const TREND_GLYPH: Record<MetricTrend, string> = {
  up: '▲',
  down: '▼',
  flat: '→',
};

export function MetricBox({ label, value, trend, testId, style }: MetricBoxProps) {
  const cls = [
    'dtm-metric-box',
    trend === 'up' ? 'is-up' : '',
    trend === 'down' ? 'is-down' : '',
    trend === 'flat' ? 'is-flat' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={cls} data-testid={testId} style={style}>
      <div className="dtm-metric-box-label">{label}</div>
      <div className="dtm-metric-box-value">
        {trend && <span className="dtm-metric-box-trend" aria-hidden="true">{TREND_GLYPH[trend]}</span>}
        <span>{value}</span>
      </div>
    </div>
  );
}
