/**
 * Tests for IlPnlPanel — the "💰 IL-费 归因盈亏" panel that wraps
 * the IlPnlChart canvas with a V2/V3 colour legend and a big
 * current-PnL readout.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IlPnlPanel } from '../IlPnlPanel';
import { useLpStore } from '@/store/lpStore';

vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

describe('IlPnlPanel', () => {
  beforeEach(() => {
    useLpStore.getState().reset();
  });

  it('renders the panel root and the canvas', () => {
    render(<IlPnlPanel />);
    expect(screen.getByTestId('il-pnl-panel')).toBeInTheDocument();
    expect(screen.getByTestId('il-pnl-canvas')).toBeInTheDocument();
  });

  it('shows the V2 / V3 legend', () => {
    render(<IlPnlPanel />);
    expect(screen.getByTestId('il-pnl-legend-v2').textContent).toMatch(/V2/);
    expect(screen.getByTestId('il-pnl-legend-v3').textContent).toMatch(/V3/);
  });

  it('shows a current PnL big number', () => {
    useLpStore.getState().setPriceRatio(2);
    render(<IlPnlPanel />);
    // Should contain a $-prefixed number for the current PnL.
    expect(screen.getByTestId('il-pnl-current').textContent).toMatch(/\$/);
  });
});
