/**
 * Tests for LpParams — the V2/V3 toggle + 4 ParamSliders panel for
 * the LP/IL microscope.  Reads & writes the lpStore.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LpParams } from '../LpParams';
import { useLpStore } from '@/store/lpStore';

describe('LpParams', () => {
  beforeEach(() => {
    useLpStore.getState().reset();
  });

  it('renders the panel root with the V2/V3 tab bar', () => {
    render(<LpParams />);
    expect(screen.getByTestId('lpil-params-panel')).toBeInTheDocument();
    expect(screen.getByTestId('lpil-params-tab-v2')).toBeInTheDocument();
    expect(screen.getByTestId('lpil-params-tab-v3')).toBeInTheDocument();
  });

  it('renders 4 ParamSliders', () => {
    render(<LpParams />);
    const ranges = document.querySelectorAll('input[type="range"]');
    expect(ranges.length).toBe(4);
  });

  it('clicking the V3 tab flips the version', () => {
    render(<LpParams />);
    act(() => {
      fireEvent.click(screen.getByTestId('lpil-params-tab-v3'));
    });
    expect(useLpStore.getState().version).toBe('v3');
  });

  it('moving the price-ratio slider updates the store', () => {
    render(<LpParams />);
    const slider = screen.getByTestId('lpil-param-price-ratio');
    const range = slider.querySelector('input[type="range"]') as HTMLInputElement;
    act(() => {
      fireEvent.change(range, { target: { value: '2' } });
    });
    expect(useLpStore.getState().priceRatio).toBe(2);
  });

  it('shows the live APR / IL% readouts', () => {
    render(<LpParams />);
    // IL% should match the formula for the default price ratio (1.0 ⇒ 0%).
    expect(screen.getByTestId('lpil-params-il-readout').textContent).toMatch(/0\.00%/);
  });
});
