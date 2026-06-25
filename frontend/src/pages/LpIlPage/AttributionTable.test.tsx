/**
 * Tests for the AttributionTable component (LP/IL page).
 */

import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AttributionTable } from './AttributionTable';
import type { AttributionRow } from './AttributionTable';

afterEach(() => {
  cleanup();
});

function makeRow(over: Partial<AttributionRow> = {}): AttributionRow {
  return {
    id: 'lp-0',
    fees: 100,
    rewards: 25,
    il: -40,
    ...over,
  };
}

describe('AttributionTable', () => {
  it('renders a single row for the selected position', () => {
    render(<AttributionTable row={makeRow()} />);
    expect(screen.getByTestId('attribution-row')).toBeInTheDocument();
  });

  it('shows the position id in the row', () => {
    render(<AttributionTable row={makeRow({ id: 'lp-9' })} />);
    expect(screen.getByText('lp-9')).toBeInTheDocument();
  });

  it('shows fees, rewards, IL, and net P&L columns', () => {
    render(<AttributionTable row={makeRow()} />);
    expect(screen.getByText(/fees/i)).toBeInTheDocument();
    expect(screen.getByText(/rewards/i)).toBeInTheDocument();
    expect(screen.getByText(/IL/i)).toBeInTheDocument();
    expect(screen.getByText(/net/i)).toBeInTheDocument();
  });

  it('formats the net P&L as the sum of fees + rewards + IL', () => {
    render(<AttributionTable row={makeRow({ fees: 100, rewards: 25, il: -40 })} />);
    // Net = 100 + 25 - 40 = 85
    expect(screen.getByText(/\$85/)).toBeInTheDocument();
  });

  it('renders an empty state when no row is provided', () => {
    render(<AttributionTable row={null} />);
    expect(screen.getByText(/no position selected/i)).toBeInTheDocument();
  });

  it('shows the fees, rewards and IL formatted as USD amounts', () => {
    render(<AttributionTable row={makeRow({ fees: 1234, rewards: 56, il: -78 })} />);
    expect(screen.getByText(/\$1\.23K/)).toBeInTheDocument();
    expect(screen.getByText(/\$56/)).toBeInTheDocument();
    expect(screen.getByText(/-.*\$78/)).toBeInTheDocument();
  });
});
