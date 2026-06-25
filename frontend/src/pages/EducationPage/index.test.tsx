/**
 * Tests for the EducationPage placeholder.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { EducationPage } from './index';

afterEach(() => {
  cleanup();
});

describe('EducationPage', () => {
  it('renders the panel with the expected testId', () => {
    render(<EducationPage />);
    expect(screen.getByTestId('education-panel')).toBeInTheDocument();
  });

  it('displays the page title', () => {
    render(<EducationPage />);
    expect(screen.getByText('Education')).toBeInTheDocument();
  });

  it('expands the explain box when the toggle is clicked', () => {
    render(<EducationPage />);
    fireEvent.click(screen.getByRole('button', { name: /toggle explanation/i }));
    expect(screen.getByText(/entry point for new users/i)).toBeInTheDocument();
  });
});
