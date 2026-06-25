/**
 * Tests for ExperimentControls — 3 buttons (开始仿真 / 暂停 / 重置) +
 * a step counter.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExperimentControls } from '../ExperimentControls';

describe('ExperimentControls', () => {
  it('renders the 3 buttons', () => {
    render(<ExperimentControls />);
    expect(screen.getByTestId('liquidation-experiment-start')).toBeInTheDocument();
    expect(screen.getByTestId('liquidation-experiment-pause')).toBeInTheDocument();
    expect(screen.getByTestId('liquidation-experiment-reset')).toBeInTheDocument();
  });

  it('invokes the start handler when 开始仿真 is clicked', () => {
    const start = vi.fn();
    render(<ExperimentControls onStart={start} />);
    fireEvent.click(screen.getByTestId('liquidation-experiment-start'));
    expect(start).toHaveBeenCalled();
  });

  it('invokes the pause handler when 暂停 is clicked', () => {
    const pause = vi.fn();
    render(<ExperimentControls onPause={pause} />);
    fireEvent.click(screen.getByTestId('liquidation-experiment-pause'));
    expect(pause).toHaveBeenCalled();
  });

  it('invokes the reset handler when 重置 is clicked', () => {
    const reset = vi.fn();
    render(<ExperimentControls onReset={reset} />);
    fireEvent.click(screen.getByTestId('liquidation-experiment-reset'));
    expect(reset).toHaveBeenCalled();
  });

  it('renders the step counter', () => {
    render(<ExperimentControls step={5} />);
    expect(screen.getByTestId('liquidation-experiment-step')).toHaveTextContent('5');
  });
});
