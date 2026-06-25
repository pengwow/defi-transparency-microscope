/**
 * Tests for ForkAmmPanel — hosts the ForkAmm canvas plus a
 * "x*y=k 恒积" label and a live (x, y) readout of the current state.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Stub useCanvas so we don't need a real canvas in jsdom.
vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

import { ForkAmmPanel } from '../ForkAmmPanel';

describe('ForkAmmPanel', () => {
  it('renders the canvas element', () => {
    render(<ForkAmmPanel />);
    expect(screen.getByTestId('fork-amm-canvas')).toBeInTheDocument();
  });

  it('renders the constant-product label', () => {
    render(<ForkAmmPanel />);
    expect(screen.getByText(/x\*y=k/)).toBeInTheDocument();
  });

  it('renders the (x, y) readout', () => {
    render(<ForkAmmPanel />);
    expect(screen.getByTestId('fork-amm-readout').textContent).toMatch(/\(.*\)/);
  });
});
