/**
 * Tests for the CheatSheet component (Education).
 */

import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CheatSheet } from './CheatSheet';
import type { FormulaCard } from './CheatSheet';

afterEach(() => {
  cleanup();
});

const CARDS: ReadonlyArray<FormulaCard> = [
  {
    id: 'cpmm',
    title: 'CPMM',
    formula: 'x * y = k',
    description: 'Constant product invariant.',
  },
  {
    id: 'il',
    title: 'Impermanent Loss (V2)',
    formula: 'IL = 2*sqrt(p) / (1+p) - 1',
    description: 'IL as a function of price ratio p.',
  },
  {
    id: 'hf',
    title: 'Health Factor',
    formula: 'HF = (collateral * threshold) / debt',
    description: 'Liquidatable when HF < 1.',
  },
  {
    id: 'attribution',
    title: 'PnL Attribution',
    formula: 'net = priceImpact + fees - gas + rebates',
    description: 'Components of an LP swap P&L.',
  },
];

describe('CheatSheet', () => {
  it('renders 4 cards', () => {
    render(<CheatSheet cards={CARDS} />);
    expect(screen.getAllByTestId('cheat-card')).toHaveLength(4);
  });

  it('shows the formula in monospace', () => {
    render(<CheatSheet cards={CARDS} />);
    expect(screen.getByText('x * y = k')).toBeInTheDocument();
  });

  it('shows the title and description', () => {
    render(<CheatSheet cards={CARDS} />);
    expect(screen.getByText('CPMM')).toBeInTheDocument();
    expect(screen.getByText(/Constant product invariant/i)).toBeInTheDocument();
  });

  it('renders an empty state when no cards are provided', () => {
    render(<CheatSheet cards={[]} />);
    expect(screen.getByText(/formulas available/i)).toBeInTheDocument();
  });
});
