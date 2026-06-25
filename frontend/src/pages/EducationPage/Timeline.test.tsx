/**
 * Tests for the Timeline component (Education).
 */

import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Timeline } from './Timeline';
import type { TimelineStep } from './Timeline';

afterEach(() => {
  cleanup();
});

const STEPS: ReadonlyArray<TimelineStep> = [
  { id: '1', title: 'CPMM', summary: 'x*y=k constant product' },
  { id: '2', title: 'IL', summary: 'impermanent loss' },
  { id: '3', title: 'HF', summary: 'health factor' },
  { id: '4', title: 'MEV', summary: 'sandwich attacks' },
  { id: '5', title: 'PnL', summary: 'attribution' },
  { id: '6', title: 'Report', summary: 'exporting' },
];

describe('Timeline', () => {
  it('renders 6 steps', () => {
    render(<Timeline steps={STEPS} activeId="1" onSelect={() => undefined} />);
    expect(screen.getAllByTestId('timeline-step')).toHaveLength(6);
  });

  it('marks the active step with data-active="true"', () => {
    render(<Timeline steps={STEPS} activeId="3" onSelect={() => undefined} />);
    const steps = screen.getAllByTestId('timeline-step');
    expect(steps[0].getAttribute('data-active')).toBe('false');
    expect(steps[2].getAttribute('data-active')).toBe('true');
  });

  it('shows the step title and summary', () => {
    render(<Timeline steps={STEPS} activeId="1" onSelect={() => undefined} />);
    expect(screen.getByText('CPMM')).toBeInTheDocument();
    expect(screen.getByText('x*y=k constant product')).toBeInTheDocument();
  });

  it('invokes onSelect with the step id when clicked', () => {
    const cb = vi.fn();
    render(<Timeline steps={STEPS} activeId="1" onSelect={cb} />);
    fireEvent.click(screen.getAllByTestId('timeline-step')[2].querySelector('button')!);
    expect(cb).toHaveBeenCalledWith('3');
  });

  it('renders an empty state when no steps are provided', () => {
    render(<Timeline steps={[]} activeId={null} onSelect={() => undefined} />);
    expect(screen.getByText(/learning steps/i)).toBeInTheDocument();
  });
});
