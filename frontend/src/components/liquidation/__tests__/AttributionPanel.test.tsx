/**
 * Tests for AttributionPanel — 5-row liquidation breakdown:
 * 清算人 / 罚金 / 实际到账 / 损失方 / 协议费.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AttributionPanel } from '../AttributionPanel';

describe('AttributionPanel', () => {
  it('renders the panel', () => {
    render(<AttributionPanel />);
    expect(screen.getByTestId('liquidation-attribution-panel')).toBeInTheDocument();
  });

  it('renders 5 attribution rows', () => {
    render(<AttributionPanel />);
    const rows = screen.getAllByTestId(/^attribution-row-/);
    expect(rows.length).toBe(5);
  });

  it('renders a "清算人" row', () => {
    render(<AttributionPanel />);
    expect(screen.getByText(/清算人/)).toBeInTheDocument();
  });
});
