/**
 * Tests for the MevAttribution row-list.
 *
 * The component derives percentages and per-row profit from
 * `useLiveStore.mempool`.  We seed the mempool with a known mix
 * (38 sandwich / 24 arb / 18 jit / 12 liquidation / 8 normal =
 * 100 entries → 38% sandwich) so the assertions are deterministic.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MevAttribution } from '../MevAttribution';
import { useLiveStore } from '@/store/liveStore';

function seedMempool(): void {
  const entries = [
    ...Array.from({ length: 38 }, (_, i) => ({ hash: `0xs${i}`, from: '0xa', timestamp: 1, mevType: 'sandwich' as const })),
    ...Array.from({ length: 24 }, (_, i) => ({ hash: `0xa${i}`, from: '0xa', timestamp: 1, mevType: 'arb' as const })),
    ...Array.from({ length: 18 }, (_, i) => ({ hash: `0xj${i}`, from: '0xa', timestamp: 1, mevType: 'jit' as const })),
    ...Array.from({ length: 12 }, (_, i) => ({ hash: `0xl${i}`, from: '0xa', timestamp: 1, mevType: 'liquidation' as const })),
    ...Array.from({ length: 8 }, (_, i) => ({ hash: `0xn${i}`, from: '0xa', timestamp: 1, mevType: 'normal' as const })),
  ];
  useLiveStore.getState().reset();
  useLiveStore.getState().init({ mempool: entries });
}

beforeEach(() => {
  seedMempool();
});

describe('MevAttribution', () => {
  it('renders five category rows', () => {
    render(<MevAttribution />);
    expect(screen.getAllByTestId(/^mev-attr-row-/).length).toBe(5);
  });

  it('shows the percentage and profit for the dominant category', () => {
    render(<MevAttribution />);
    const sandwich = screen.getByTestId('mev-attr-row-sandwich');
    expect(sandwich.textContent).toMatch(/38/);
    expect(sandwich.textContent).toMatch(/\$\d/);
  });

  it('aggregates store "arb" into the display "arbitrage" row', () => {
    render(<MevAttribution />);
    const arb = screen.getByTestId('mev-attr-row-arbitrage');
    // 24 / 100 = 24%
    expect(arb.textContent).toMatch(/24/);
    // 24 * $890 = $21,360
    expect(arb.textContent).toMatch(/\$21,360/);
  });

  it('renders the "Backend: demo" badge when no backend is connected', () => {
    render(<MevAttribution />);
    const badge = screen.getByTestId('mev-attribution-source-badge');
    expect(badge.getAttribute('data-source')).toBe('demo');
    expect(badge.textContent).toMatch(/demo/);
  });

  it('renders the "Backend: live" badge when the store is connected', () => {
    useLiveStore.getState().setBackendConnected(true);
    render(<MevAttribution />);
    const badge = screen.getByTestId('mev-attribution-source-badge');
    expect(badge.getAttribute('data-source')).toBe('backend');
    expect(badge.textContent).toMatch(/live/);
  });

  it('shows dashes and 0% for an empty mempool', () => {
    useLiveStore.getState().reset();
    useLiveStore.getState().init({ mempool: [] });
    render(<MevAttribution />);
    const sandwich = screen.getByTestId('mev-attr-row-sandwich');
    expect(sandwich.textContent).toMatch(/0%/);
    expect(sandwich.textContent).toMatch(/—/);
  });
});
