/**
 * Tests for ForkTimeline — 4-step sandwich event timeline.
 *
 * Renders "前跑 → Swap → 后跑 → 清算" with each step showing a
 * timestamp and a description.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ForkTimeline } from '../ForkTimeline';

describe('ForkTimeline', () => {
  it('renders 4 timeline items', () => {
    render(<ForkTimeline />);
    const items = screen.getAllByTestId(/^fork-timeline-item-/);
    expect(items).toHaveLength(4);
  });

  it('renders all 4 step names', () => {
    render(<ForkTimeline />);
    expect(screen.getByText(/前跑/)).toBeInTheDocument();
    expect(screen.getByText(/Swap/)).toBeInTheDocument();
    expect(screen.getByText(/后跑/)).toBeInTheDocument();
    expect(screen.getByText(/清算/)).toBeInTheDocument();
  });

  it('renders a timestamp for each step', () => {
    render(<ForkTimeline />);
    // Timestamps are rendered as 4 separate dtm-timeline-time elements.
    const times = document.querySelectorAll('.dtm-timeline-time');
    expect(times.length).toBeGreaterThanOrEqual(4);
  });

  it('renders a description for each step', () => {
    render(<ForkTimeline />);
    expect(screen.getByText(/策略方买入/)).toBeInTheDocument();
    expect(screen.getByText(/交易发起方/)).toBeInTheDocument();
    expect(screen.getByText(/策略方卖出/)).toBeInTheDocument();
    expect(screen.getByText(/归还借款/)).toBeInTheDocument();
  });
});
