/**
 * Tests for IlCurvePanel — wraps the existing ILCurve canvas with a
 * "📊 IL 机理曲线" title, a current-point marker, and a V2/V3
 * mini-readout.
 *
 * The component is driven by `lpStore.priceRatio` and `lpStore.version`.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IlCurvePanel } from '../IlCurvePanel';
import { useLpStore } from '@/store/lpStore';

vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

describe('IlCurvePanel', () => {
  beforeEach(() => {
    useLpStore.getState().reset();
  });

  it('renders the panel root and the IL canvas', () => {
    render(<IlCurvePanel />);
    expect(screen.getByTestId('il-curve-panel')).toBeInTheDocument();
    expect(screen.getByTestId('il-curve-canvas')).toBeInTheDocument();
  });

  it('shows the current price-ratio marker', () => {
    useLpStore.getState().setPriceRatio(2);
    render(<IlCurvePanel />);
    // 2.00x readout should be present.
    expect(screen.getByTestId('il-curve-current-marker').textContent).toMatch(/2\.00x/);
  });

  it('switches the V3 indicator when the version is v3', () => {
    useLpStore.getState().setVersion('v3');
    render(<IlCurvePanel />);
    expect(screen.getByTestId('il-curve-version-pill').textContent).toMatch(/V3/);
  });
});
