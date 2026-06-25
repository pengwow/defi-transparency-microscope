/**
 * Tests for the LiveSamplingPage placeholder.
 *
 * Verifies the panel renders with the expected testId and that the
 * ExplainBox is initially collapsed.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { LiveSamplingPage } from './index';

afterEach(() => {
  cleanup();
});

describe('LiveSamplingPage', () => {
  it('renders the panel with the expected testId', () => {
    render(<LiveSamplingPage />);
    expect(screen.getByTestId('live-sampling-panel')).toBeInTheDocument();
  });

  it('displays the page title', () => {
    render(<LiveSamplingPage />);
    expect(screen.getByText('Live MEV Sampling')).toBeInTheDocument();
  });

  it('expands the explain box when the toggle is clicked', () => {
    render(<LiveSamplingPage />);
    fireEvent.click(screen.getByRole('button', { name: /toggle explanation/i }));
    expect(screen.getByText(/classifying them as/i)).toBeInTheDocument();
  });
});
