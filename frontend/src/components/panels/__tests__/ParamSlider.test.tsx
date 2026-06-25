/**
 * Tests for ParamSlider — labelled range input with mono-font value.
 *
 *   <ParamSlider label="Reserve" min={0} max={100} value={42}
 *                 onChange={setR} suffix="%" />
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ParamSlider } from '../ParamSlider';

describe('ParamSlider', () => {
  it('renders the label and the current value with suffix', () => {
    render(
      <ParamSlider
        label="Reserve"
        min={0}
        max={100}
        value={42}
        onChange={() => undefined}
        suffix="%"
      />,
    );
    expect(screen.getByText('Reserve')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('renders the precision', () => {
    render(
      <ParamSlider
        label="Price"
        min={0}
        max={10}
        step={0.1}
        value={1.23456}
        onChange={() => undefined}
        precision={2}
      />,
    );
    expect(screen.getByText('1.23')).toBeInTheDocument();
  });

  it('invokes onChange when the slider value changes', () => {
    const cb = vi.fn();
    render(
      <ParamSlider
        label="X"
        min={0}
        max={100}
        value={0}
        onChange={cb}
        id="x-slider"
      />,
    );
    const input = document.getElementById('x-slider') as HTMLInputElement;
    fireEvent.input(input, { target: { value: '50' } });
    expect(cb).toHaveBeenCalledWith(50);
  });

  it('marks the input as disabled when disabled is true', () => {
    render(
      <ParamSlider
        label="X"
        min={0}
        max={100}
        value={10}
        onChange={() => undefined}
        disabled
        id="disabled-slider"
      />,
    );
    const input = document.getElementById('disabled-slider') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});
