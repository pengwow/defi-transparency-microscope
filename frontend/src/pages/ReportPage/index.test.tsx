/**
 * Tests for the ReportPage placeholder.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ReportPage } from './index';

afterEach(() => {
  cleanup();
});

describe('ReportPage', () => {
  it('renders the panel with the expected testId', () => {
    render(<ReportPage />);
    expect(screen.getByTestId('report-panel')).toBeInTheDocument();
  });

  it('displays the page title', () => {
    render(<ReportPage />);
    expect(screen.getByText('Session Report')).toBeInTheDocument();
  });

  it('expands the explain box when the toggle is clicked', () => {
    render(<ReportPage />);
    fireEvent.click(screen.getByRole('button', { name: /toggle explanation/i }));
    expect(screen.getByText(/Export it as JSON/i)).toBeInTheDocument();
  });
});
