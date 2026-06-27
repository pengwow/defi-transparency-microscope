/**
 * Tests for the LiveAmmPanel — canvas + price ticker combo.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

// Stub useCanvas to a no-op (we only check DOM rendering here).
vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

import { LiveAmmPanel } from '../LiveAmmPanel';
import { useLiveStore } from '@/store/liveStore';
import {
  getLivePrice,
  resetLiveAmm,
  setLivePrice,
} from '@/canvas/LiveAmm';

describe('LiveAmmPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the module-level chart and the live store so each
    // test starts from a known baseline.
    resetLiveAmm();
    useLiveStore.getState().reset();
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

  it('shows the "Backend: demo" badge in mock / disconnected mode', () => {
    // Default state: backendConnected is false (store was just reset).
    expect(useLiveStore.getState().backendConnected).toBe(false);
    render(<LiveAmmPanel />);
    const badge = screen.getByTestId('live-amm-source');
    expect(badge.textContent).toMatch(/Backend:\s*demo/);
    expect(badge.className).toMatch(/is-demo/);
    expect(badge.className).not.toMatch(/is-live/);
  });

  it('flips the badge to "Backend: live" once the store reports connected', () => {
    useLiveStore.getState().setBackendConnected(true);
    render(<LiveAmmPanel />);
    const badge = screen.getByTestId('live-amm-source');
    expect(badge.textContent).toMatch(/Backend:\s*live/);
    expect(badge.className).toMatch(/is-live/);
    expect(badge.className).not.toMatch(/is-demo/);
  });

  it('reacts to backendConnected flipping while the panel is mounted', () => {
    render(<LiveAmmPanel />);
    // Mock mode first.
    const badge = screen.getByTestId('live-amm-source');
    expect(badge.textContent).toMatch(/demo/);
    // Flip the store and wrap in act() so the subscription-driven
    // re-render flushes before we read the DOM.
    act(() => {
      useLiveStore.getState().setBackendConnected(true);
    });
    expect(screen.getByTestId('live-amm-source').textContent).toMatch(/live/);
  });

  it('uses the live store AMM price (1e18 fixed point) instead of demo random walk', () => {
    // Push a real price into the live store and render the panel.
    const realPrice = 2735.5;
    useLiveStore.getState().setAmmPrice(BigInt(Math.round(realPrice * 1e18)));
    render(<LiveAmmPanel />);
    // The panel's useEffect should have called setLivePrice(realPrice)
    // on mount (or on the next render after ammPriceE18 changed).
    // We can verify the chart's current price matches the value
    // we pushed — this is the key behaviour: real prices from the
    // live store feed the chart, not the demo random walk.
    expect(getLivePrice()).toBeCloseTo(realPrice, 3);
    // The real price was pushed once via setLivePrice, so re-pushing
    // the same value should be deduped (chart history stays bounded).
    expect(setLivePrice(realPrice)).toBe(false);
  });
});
