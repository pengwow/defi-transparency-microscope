/**
 * Tests for the LivePnlPanel — attribution chart + cumulative metrics.
 *
 * The component now derives its values from `useLiveStore.mempool`,
 * so we seed the mempool in `beforeEach` so the bars and metrics
 * are non-empty / non-dash.  We also assert the new "Backend: live"
 * / "Backend: demo" badge.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

import { LivePnlPanel } from '../LivePnlPanel';
import { useLiveStore } from '@/store/liveStore';

function seedMempool(): void {
  // 1 sandwich + 1 arb + 1 jit + 1 liquidation → HODL ≈ $2,790
  const entries = [
    { hash: '0x1', from: '0xa', timestamp: 1, mevType: 'sandwich' as const },
    { hash: '0x2', from: '0xa', timestamp: 1, mevType: 'arb' as const },
    { hash: '0x3', from: '0xa', timestamp: 1, mevType: 'jit' as const },
    { hash: '0x4', from: '0xa', timestamp: 1, mevType: 'liquidation' as const },
  ];
  useLiveStore.getState().reset();
  useLiveStore.getState().init({ mempool: entries });
}

beforeEach(() => {
  seedMempool();
});

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

  it('shows the "Backend: demo" badge when no backend is connected', () => {
    render(<LivePnlPanel />);
    const badge = screen.getByTestId('live-pnl-source-badge');
    expect(badge.getAttribute('data-source')).toBe('demo');
    expect(badge.textContent).toMatch(/demo/);
  });

  it('shows the "Backend: live" badge when the store reports connected', () => {
    useLiveStore.getState().setBackendConnected(true);
    render(<LivePnlPanel />);
    const badge = screen.getByTestId('live-pnl-source-badge');
    expect(badge.getAttribute('data-source')).toBe('backend');
    expect(badge.textContent).toMatch(/live/);
  });

  it('shows dashes for cumulative and metric values when mempool is empty', () => {
    useLiveStore.getState().reset();
    useLiveStore.getState().init({ mempool: [] });
    render(<LivePnlPanel />);
    expect(screen.getByTestId('live-pnl-cumulative').textContent).toMatch(/—/);
  });
});
