/**
 * Tests for the LivePnlPanel — attribution chart + cumulative metrics.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

import { LivePnlPanel } from '../LivePnlPanel';

describe('LivePnlPanel', () => {
  it('renders a canvas for the bar chart', () => {
    render(<LivePnlPanel />);
    expect(screen.getByTestId('live-pnl-canvas')).toBeInTheDocument();
  });

  it('renders the cumulative PnL big number', () => {
    render(<LivePnlPanel />);
    expect(screen.getByTestId('live-pnl-cumulative').textContent).toMatch(/\$|—/);
  });

  it('renders 4 metric labels', () => {
    render(<LivePnlPanel />);
    expect(screen.getAllByTestId(/^live-pnl-metric-/).length).toBe(4);
  });
});
