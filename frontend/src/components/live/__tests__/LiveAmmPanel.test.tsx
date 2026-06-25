/**
 * Tests for the LiveAmmPanel — canvas + price ticker combo.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Stub useCanvas to a no-op (we only check DOM rendering here).
vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

import { LiveAmmPanel } from '../LiveAmmPanel';

describe('LiveAmmPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the price ticker label', () => {
    render(<LiveAmmPanel />);
    expect(screen.getByText(/当前价格|当前价/)).toBeInTheDocument();
  });

  it('renders a canvas element', () => {
    render(<LiveAmmPanel />);
    expect(screen.getByTestId('live-amm-canvas')).toBeInTheDocument();
  });

  it('shows a percentage change indicator', () => {
    render(<LiveAmmPanel />);
    expect(screen.getByTestId('live-amm-change').textContent).toMatch(/%/);
  });
});
