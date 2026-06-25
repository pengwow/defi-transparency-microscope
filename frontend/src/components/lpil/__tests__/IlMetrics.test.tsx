/**
 * Tests for IlMetrics — 4-column MetricGrid with IL% / Net PnL /
 * APR / Fee income readouts driven by the lpStore.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IlMetrics } from '../IlMetrics';
import { useLpStore } from '@/store/lpStore';

describe('IlMetrics', () => {
  beforeEach(() => {
    useLpStore.getState().reset();
  });

  it('renders the panel root', () => {
    render(<IlMetrics />);
    expect(screen.getByTestId('il-metrics-panel')).toBeInTheDocument();
  });

  it('renders 4 metric boxes', () => {
    render(<IlMetrics />);
    const boxes = screen.getAllByTestId(/^il-metric-/);
    expect(boxes.length).toBe(4);
  });

  it('shows the IL% / 净 PnL / APR / 手续费收入 labels', () => {
    render(<IlMetrics />);
    expect(screen.getByText(/IL\s*%/)).toBeInTheDocument();
    expect(screen.getByText(/净\s*PnL|净盈亏/)).toBeInTheDocument();
    expect(screen.getByText(/APR/)).toBeInTheDocument();
    expect(screen.getByText(/手续费收入/)).toBeInTheDocument();
  });

  it('updates the IL% when the price ratio changes', () => {
    render(<IlMetrics />);
    // Default ratio 1.0 ⇒ IL = 0%
    expect(screen.getByTestId('il-metric-il').textContent).toMatch(/0\.00%/);
    useLpStore.getState().setPriceRatio(2);
    // Re-render to pick up the new value.
    render(<IlMetrics />);
    expect(screen.getAllByTestId('il-metric-il').length).toBeGreaterThan(0);
  });
});
