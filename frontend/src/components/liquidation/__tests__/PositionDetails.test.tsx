/**
 * Tests for PositionDetails — 6-row position info table.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PositionDetails } from '../PositionDetails';

describe('PositionDetails', () => {
  it('renders the panel', () => {
    render(<PositionDetails />);
    expect(screen.getByTestId('liquidation-position-details-panel')).toBeInTheDocument();
  });

  it('renders 6 detail rows', () => {
    render(<PositionDetails />);
    const rows = screen.getAllByTestId(/^position-details-row-/);
    expect(rows.length).toBe(6);
  });

  it('mentions the protocol name', () => {
    render(<PositionDetails />);
    expect(screen.getByText(/Aave V3/)).toBeInTheDocument();
  });
});
