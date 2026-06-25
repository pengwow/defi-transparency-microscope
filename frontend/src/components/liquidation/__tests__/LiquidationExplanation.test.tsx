/**
 * Tests for LiquidationExplanation — ExplainBox describing the
 * "清算模式" plus a formula block.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiquidationExplanation } from '../LiquidationExplanation';

describe('LiquidationExplanation', () => {
  it('renders the panel', () => {
    render(<LiquidationExplanation />);
    expect(screen.getByTestId('liquidation-explanation-panel')).toBeInTheDocument();
  });

  it('mentions "清算模式" or "清算" in the ExplainBox', () => {
    render(<LiquidationExplanation />);
    const panel = screen.getByTestId('liquidation-explanation-panel');
    expect(panel.textContent).toMatch(/清算/);
  });

  it('renders a formula block', () => {
    render(<LiquidationExplanation />);
    expect(screen.getByTestId('liquidation-explanation-formula')).toBeInTheDocument();
  });
});
