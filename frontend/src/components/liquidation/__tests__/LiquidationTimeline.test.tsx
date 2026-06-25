/**
 * Tests for LiquidationTimeline — 3-4 event steps (HF 接近 1.0 →
 * 触发清算 → 罚金分配).
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiquidationTimeline } from '../LiquidationTimeline';

describe('LiquidationTimeline', () => {
  it('renders the panel', () => {
    render(<LiquidationTimeline />);
    expect(screen.getByTestId('liquidation-timeline-panel')).toBeInTheDocument();
  });

  it('renders at least 3 steps', () => {
    render(<LiquidationTimeline />);
    const steps = screen.getAllByTestId(/^liquidation-timeline-step-/);
    expect(steps.length).toBeGreaterThanOrEqual(3);
  });

  it('mentions "触发清算"', () => {
    render(<LiquidationTimeline />);
    expect(screen.getByText(/触发清算/)).toBeInTheDocument();
  });
});
