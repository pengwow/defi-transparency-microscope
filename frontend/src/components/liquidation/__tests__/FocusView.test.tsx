/**
 * Tests for FocusView — the left + middle column of the Liquidation
 * focus mode.
 *
 * Composes AddressInput + 5 sliders + HfGauge + PriceHfCurve +
 * LiquidationTimeline.  This test verifies the top-level structure
 * (root panel testId + subcomponent panels) without depending on
 * every subcomponent's internals.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

import { FocusView } from '../FocusView';

describe('FocusView', () => {
  it('renders the root focus panel', () => {
    render(<FocusView />);
    expect(screen.getByTestId('liquidation-focus-panel')).toBeInTheDocument();
  });

  it('renders 5 simulation sliders', () => {
    render(<FocusView />);
    const sliders = screen.getAllByTestId(/^sim-param-/);
    expect(sliders.length).toBeGreaterThanOrEqual(5);
  });

  it('renders the HF gauge panel', () => {
    render(<FocusView />);
    expect(screen.getByTestId('liquidation-hf-gauge-panel')).toBeInTheDocument();
  });

  it('renders the price/HF curve panel', () => {
    render(<FocusView />);
    expect(screen.getByTestId('liquidation-price-hf-curve-panel')).toBeInTheDocument();
  });
});
