/**
 * Tests for the PriceHfCurve component — wraps the PriceHfCurve
 * canvas in a panel with the "HF=1 警戒线" label.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

import { PriceHfCurve } from '../PriceHfCurve';

describe('PriceHfCurve (component)', () => {
  it('renders the panel', () => {
    render(<PriceHfCurve />);
    expect(screen.getByTestId('liquidation-price-hf-curve-panel')).toBeInTheDocument();
  });

  it('renders the canvas', () => {
    render(<PriceHfCurve />);
    expect(screen.getByTestId('price-hf-curve-canvas')).toBeInTheDocument();
  });

  it('renders the HF=1 警戒线 annotation', () => {
    render(<PriceHfCurve />);
    expect(screen.getByText(/HF=1 警戒线/)).toBeInTheDocument();
  });
});
