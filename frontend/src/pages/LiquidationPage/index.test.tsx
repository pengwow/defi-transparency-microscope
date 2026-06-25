/**
 * Tests for the LiquidationPage placeholder.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { LiquidationPage } from './index';

afterEach(() => {
  cleanup();
});

describe('LiquidationPage', () => {
  it('renders the panel with the expected testId', () => {
    render(<LiquidationPage />);
    expect(screen.getByTestId('liquidation-panel')).toBeInTheDocument();
  });

  it('displays the page title', () => {
    render(<LiquidationPage />);
    expect(screen.getByText('Liquidation Risk')).toBeInTheDocument();
  });

  it('expands the explain box when the toggle is clicked', () => {
    render(<LiquidationPage />);
    fireEvent.click(screen.getByRole('button', { name: /toggle explanation/i }));
    expect(screen.getByText(/liquidatable when/i)).toBeInTheDocument();
  });
});
