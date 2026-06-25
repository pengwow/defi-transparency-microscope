/**
 * Tests for ProtocolStats — 3 protocol (Aave V3, Compound, MakerDAO)
 * × 4 metrics grid.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProtocolStats } from '../ProtocolStats';

describe('ProtocolStats', () => {
  it('renders the panel', () => {
    render(<ProtocolStats />);
    expect(screen.getByTestId('liquidation-protocol-stats-panel')).toBeInTheDocument();
  });

  it('renders 3 protocol rows × 4 metrics (12 cells)', () => {
    render(<ProtocolStats />);
    const cells = screen.getAllByTestId(/^protocol-stats-cell-/);
    expect(cells.length).toBe(12);
  });

  it('renders all 3 protocols', () => {
    render(<ProtocolStats />);
    expect(screen.getByTestId('protocol-stats-row-aave')).toBeInTheDocument();
    expect(screen.getByTestId('protocol-stats-row-compound')).toBeInTheDocument();
    expect(screen.getByTestId('protocol-stats-row-makerdao')).toBeInTheDocument();
  });
});
