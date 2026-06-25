/**
 * Tests for PendingMempool — a 3-5 row list of pending liquidations
 * observed in the mempool.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PendingMempool } from '../PendingMempool';

describe('PendingMempool', () => {
  it('renders the panel', () => {
    render(<PendingMempool />);
    expect(screen.getByTestId('liquidation-pending-mempool-panel')).toBeInTheDocument();
  });

  it('renders at least 3 rows of pending liquidations', () => {
    render(<PendingMempool />);
    const rows = screen.getAllByTestId(/^pending-mempool-row-/);
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it('renders a title mentioning "待归因"', () => {
    render(<PendingMempool />);
    expect(screen.getByText(/待归因/)).toBeInTheDocument();
  });
});
