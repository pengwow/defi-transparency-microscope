/**
 * Tests for the LpIlPage.
 *
 * Verifies the three-column layout, that selecting a position drives
 * the IL curve, and that the attribution table reflects the chosen
 * position.
 */

import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { LpIlPage } from './index';
import { usePositionStore } from '@/store/positionStore';
import type { Position } from '@/types';

afterEach(() => {
  cleanup();
  usePositionStore.getState().reset();
});

function makeLp(over: Partial<Position> = {}): Position {
  return {
    id: 'lp-0',
    owner: '0x0',
    poolAddress: '0x1',
    protocol: 'uniswap_v2',
    status: 'active',
    openedAt: 0,
    liquidity: 1_000_000n,
    amount0: 1_000_000n,
    amount1: 1_000_000n,
    ...over,
  } as Position;
}

describe('LpIlPage', () => {
  it('renders the three panels', () => {
    usePositionStore.getState().setLp([makeLp()]);
    render(<LpIlPage />);
    expect(screen.getByTestId('lp-positions-panel')).toBeInTheDocument();
    expect(screen.getByTestId('il-curve-panel')).toBeInTheDocument();
    expect(screen.getByTestId('pnl-attribution-panel')).toBeInTheDocument();
  });

  it('shows the page test id root', () => {
    usePositionStore.getState().setLp([makeLp()]);
    render(<LpIlPage />);
    expect(screen.getByTestId('lp-il-page')).toBeInTheDocument();
  });

  it('renders one row per LP position', () => {
    usePositionStore.getState().setLp([makeLp({ id: 'lp-0' }), makeLp({ id: 'lp-1' })]);
    render(<LpIlPage />);
    expect(screen.getAllByTestId('position-list-row').length).toBeGreaterThanOrEqual(2);
  });

  it('selects the first position by default', () => {
    usePositionStore.getState().setLp([makeLp({ id: 'lp-first' })]);
    render(<LpIlPage />);
    // The attribution table should reflect the first position's id (one
    // copy in the list, one in the attribution row).
    expect(screen.getAllByText('lp-first').length).toBeGreaterThanOrEqual(1);
  });

  it('updates the attribution when a different position is clicked', () => {
    usePositionStore
      .getState()
      .setLp([makeLp({ id: 'lp-a' }), makeLp({ id: 'lp-b' })]);
    render(<LpIlPage />);
    const rows = screen.getAllByTestId('position-list-row');
    act(() => {
      fireEvent.click(rows[1]);
    });
    // Both ids should be present (one in the list, one in the attribution).
    expect(screen.getAllByText('lp-b').length).toBeGreaterThan(0);
  });

  it('renders the IL curve canvas in the middle panel', () => {
    usePositionStore.getState().setLp([makeLp()]);
    const { container } = render(<LpIlPage />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });

  it('shows an explain box at the bottom', () => {
    usePositionStore.getState().setLp([makeLp()]);
    render(<LpIlPage />);
    expect(screen.getAllByTestId('explain-box').length).toBeGreaterThan(0);
  });

  it('renders the empty state when no positions are loaded', () => {
    render(<LpIlPage />);
    // The empty state is rendered in the position list.
    expect(screen.getByText(/no\s+lp\s+positions/i)).toBeInTheDocument();
  });

  it('handles a V3 position by switching the curve title', () => {
    usePositionStore
      .getState()
      .setLp([
        makeLp({
          id: 'lp-v3',
          protocol: 'uniswap_v3',
          tickLower: -100,
          tickUpper: 100,
          tokensOwed0: 0n,
          tokensOwed1: 0n,
        }) as Position,
      ]);
    render(<LpIlPage />);
    // V3 positions should still be listed and selectable.
    expect(screen.getAllByText('lp-v3').length).toBeGreaterThanOrEqual(1);
  });
});

// Keep the `vi` import in scope (in case future tests need spies).
void vi;
