/**
 * Tests for SimParams — 5 simulation sliders (collateral / debt /
 * price / bonus / ltv) wired to the liquidationStore.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SimParams } from '../SimParams';
import { useLiquidationStore } from '@/store/liquidationStore';

beforeEach(() => {
  useLiquidationStore.getState().reset();
});

describe('SimParams', () => {
  it('renders the panel', () => {
    render(<SimParams />);
    expect(screen.getByTestId('liquidation-sim-params-panel')).toBeInTheDocument();
  });

  it('renders exactly 5 sliders', () => {
    render(<SimParams />);
    const sliders = screen.getAllByTestId(/^sim-param-/);
    expect(sliders.length).toBe(5);
  });

  it('renders the current slider values from the store', () => {
    useLiquidationStore.getState().setSlider('collateral', 25);
    useLiquidationStore.getState().setSlider('price', 1800);
    render(<SimParams />);
    // The ParamSlider uses .dtm-form-value to show the current value.
    const panel = screen.getByTestId('liquidation-sim-params-panel');
    expect(panel.textContent).toContain('25');
    expect(panel.textContent).toContain('1800');
  });
});
