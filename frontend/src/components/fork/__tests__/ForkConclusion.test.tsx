/**
 * Tests for ForkConclusion — the "实验结论" panel on the Fork tab.
 *
 * Renders the demo conclusion paragraph ("深池子天然抗 MEV") plus a
 * formula block (`Δx / X = Δy / Y`).
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ForkConclusion } from '../ForkConclusion';

describe('ForkConclusion', () => {
  it('renders the conclusion text', () => {
    render(<ForkConclusion />);
    expect(screen.getByText(/深池子天然抗 MEV/)).toBeInTheDocument();
  });

  it('renders the formula block', () => {
    render(<ForkConclusion />);
    expect(screen.getByTestId('fork-conclusion-formula')).toBeInTheDocument();
  });

  it('renders both current and target pool-depth values in the text', () => {
    render(<ForkConclusion />);
    const text = screen.getByTestId('fork-conclusion').textContent;
    expect(text).toMatch(/1,?000\s*WETH/);
    expect(text).toMatch(/5,?000\s*WETH/);
  });
});
