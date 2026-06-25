/**
 * Tests for ExperimentCard — clickable scenario card with icon,
 * title, description, and an active state.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExperimentCard } from '../ExperimentCard';

describe('ExperimentCard', () => {
  it('renders icon, title, and description', () => {
    render(
      <ExperimentCard
        icon="🔬"
        title="Sandwich"
        description="Front-run + back-run"
        testId="exp-card"
      />,
    );
    expect(screen.getByText('🔬')).toBeInTheDocument();
    expect(screen.getByText('Sandwich')).toBeInTheDocument();
    expect(screen.getByText('Front-run + back-run')).toBeInTheDocument();
    expect(screen.getByTestId('exp-card')).toBeInTheDocument();
  });

  it('invokes onClick when clicked', () => {
    const cb = vi.fn();
    render(
      <ExperimentCard
        icon="x"
        title="T"
        description="d"
        onClick={cb}
        testId="click-card"
      />,
    );
    fireEvent.click(screen.getByTestId('click-card'));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('adds the is-active class when active is true', () => {
    render(
      <ExperimentCard
        icon="x"
        title="T"
        description="d"
        active
        testId="active-card"
      />,
    );
    expect(screen.getByTestId('active-card').className).toContain('is-active');
  });
});
