/**
 * Tests for the EducationPage.
 */

import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { EducationPage } from './index';

afterEach(() => {
  cleanup();
});

describe('EducationPage', () => {
  it('renders the three panels', () => {
    render(<EducationPage />);
    expect(screen.getByTestId('learning-path-panel')).toBeInTheDocument();
    expect(screen.getByTestId('cheat-sheet-panel')).toBeInTheDocument();
    expect(screen.getByTestId('glossary-panel')).toBeInTheDocument();
  });

  it('shows the page test id root', () => {
    render(<EducationPage />);
    expect(screen.getByTestId('education-page')).toBeInTheDocument();
  });

  it('renders 6 timeline steps', () => {
    render(<EducationPage />);
    expect(screen.getAllByTestId('timeline-step')).toHaveLength(6);
  });

  it('renders 4 cheat sheet cards', () => {
    render(<EducationPage />);
    expect(screen.getAllByTestId('cheat-card')).toHaveLength(4);
  });

  it('renders 6 glossary entries', () => {
    render(<EducationPage />);
    expect(screen.getAllByTestId('glossary-entry')).toHaveLength(6);
  });

  it('shows an explain box at the bottom of each panel', () => {
    render(<EducationPage />);
    expect(screen.getAllByTestId('explain-box').length).toBeGreaterThanOrEqual(3);
  });

  it('updates the active step when a timeline step is clicked', () => {
    render(<EducationPage />);
    const steps = screen.getAllByTestId('timeline-step');
    fireEvent.click(steps[2].querySelector('button')!);
    // Step 3 should now be active (data-active="true").
    expect(steps[2].getAttribute('data-active')).toBe('true');
  });

  it('starts with the first step active by default', () => {
    render(<EducationPage />);
    const steps = screen.getAllByTestId('timeline-step');
    expect(steps[0].getAttribute('data-active')).toBe('true');
  });
});

// Keep the `vi` import in scope for future tests.
void vi;
