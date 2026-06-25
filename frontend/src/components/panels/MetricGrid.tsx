/**
 * MetricGrid — grid container for MetricBox children.
 *
 *   <MetricGrid columns={4}>
 *     <MetricBox ... />
 *     <MetricBox ... />
 *   </MetricGrid>
 *
 * Uses `grid-template-columns: repeat(N, 1fr)`; the column count is
 * also reflected as a class hook (`cols-N`) so the CSS can override
 * the default gap.
 */

import type { CSSProperties, ReactNode } from 'react';

export interface MetricGridProps {
  /** Number of equal-width columns (default 3). */
  columns?: 2 | 3 | 4;
  children: ReactNode;
  testId?: string;
  style?: CSSProperties;
}

export function MetricGrid({ columns = 3, children, testId, style }: MetricGridProps) {
  const cls = `dtm-metric-grid cols-${columns}`;
  return (
    <div
      className={cls}
      data-testid={testId}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, ...style }}
    >
      {children}
    </div>
  );
}
