/**
 * Tests for QuantResults — the "量化结果" panel on the Fork tab.
 *
 * Renders a RiskGauge for attacker profit / pool depth, plus a
 * MetricGrid of 4 metrics (slippage, profit, cost, ROI).
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuantResults } from '../QuantResults';

describe('QuantResults', () => {
  it('renders the risk gauge', () => {
    render(<QuantResults />);
    expect(screen.getByTestId('quant-risk-gauge')).toBeInTheDocument();
  });

  it('renders all 4 metric labels', () => {
    render(<QuantResults />);
    expect(screen.getByText('滑点')).toBeInTheDocument();
    expect(screen.getByText('利润')).toBeInTheDocument();
    expect(screen.getByText('成本')).toBeInTheDocument();
    expect(screen.getByText('ROI')).toBeInTheDocument();
  });

  it('renders 4 metric boxes inside a 2x2 metric grid', () => {
    render(<QuantResults />);
    const boxes = screen.getAllByTestId(/^quant-metric-/);
    expect(boxes).toHaveLength(4);
  });
});
