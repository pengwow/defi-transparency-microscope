/**
 * Tests for the ForkExperimentPage placeholder.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ForkExperimentPage } from './index';

afterEach(() => {
  cleanup();
});

describe('ForkExperimentPage', () => {
  it('renders the panel with the expected testId', () => {
    render(<ForkExperimentPage />);
    expect(screen.getByTestId('fork-experiment-panel')).toBeInTheDocument();
  });

  it('displays the page title', () => {
    render(<ForkExperimentPage />);
    expect(screen.getByText('Fork Experiments')).toBeInTheDocument();
  });

  it('expands the explain box when the toggle is clicked', () => {
    render(<ForkExperimentPage />);
    fireEvent.click(screen.getByRole('button', { name: /toggle explanation/i }));
    expect(screen.getByText(/cost of sandwiching/i)).toBeInTheDocument();
  });
});
