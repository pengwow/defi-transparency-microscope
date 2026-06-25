/**
 * Tests for PoolStatePanel — 5-row pool state table (Reserve0 /
 * Reserve1 / LP token supply / 当前价格 / 价格比).
 *
 * Values are derived from `lpStore` (deposit + price ratio) using a
 * constant-product mock pool.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PoolStatePanel } from '../PoolStatePanel';
import { useLpStore } from '@/store/lpStore';

describe('PoolStatePanel', () => {
  beforeEach(() => {
    useLpStore.getState().reset();
  });

  it('renders the panel root', () => {
    render(<PoolStatePanel />);
    expect(screen.getByTestId('pool-state-panel')).toBeInTheDocument();
  });

  it('renders 5 rows', () => {
    render(<PoolStatePanel />);
    const rows = screen.getAllByTestId(/^pool-state-row-/);
    expect(rows.length).toBe(5);
  });

  it('shows the Reserve0 / Reserve1 / LP token supply / 当前价格 / 价格比 labels', () => {
    render(<PoolStatePanel />);
    expect(screen.getByText(/Reserve0|储备\s*0/)).toBeInTheDocument();
    expect(screen.getByText(/Reserve1|储备\s*1/)).toBeInTheDocument();
    expect(screen.getByText(/LP token supply|LP 供应|LP 总量/)).toBeInTheDocument();
    expect(screen.getByText(/当前价格/)).toBeInTheDocument();
    expect(screen.getByText(/价格比/)).toBeInTheDocument();
  });

  it('shows the current price ratio value', () => {
    useLpStore.getState().setPriceRatio(2);
    render(<PoolStatePanel />);
    const row = screen.getByTestId('pool-state-row-ratio');
    expect(row.textContent).toMatch(/2\.00x/);
  });
});
