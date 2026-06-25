/**
 * Tests for the LpIlPage placeholder.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { LpIlPage } from './index';

afterEach(() => {
  cleanup();
});

describe('LpIlPage', () => {
  it('renders the panel with the expected testId', () => {
    render(<LpIlPage />);
    expect(screen.getByTestId('lp-il-panel')).toBeInTheDocument();
  });

  it('displays the page title', () => {
    render(<LpIlPage />);
    expect(screen.getByText('LP Impermanent Loss')).toBeInTheDocument();
  });

  it('expands the explain box when the toggle is clicked', () => {
    render(<LpIlPage />);
    fireEvent.click(screen.getByRole('button', { name: /toggle explanation/i }));
    expect(screen.getByText(/HODL baseline/i)).toBeInTheDocument();
  });
});
