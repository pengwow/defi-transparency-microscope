/**
 * Tests for the RecentSamples list (last 10 mempool entries).
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecentSamples } from '../RecentSamples';
import { useLiveStore } from '@/store/liveStore';

function seedMempool(n: number): void {
  const entries = Array.from({ length: n }, (_, i) => ({
    hash: '0x' + i.toString(16).padStart(64, '0'),
    from: '0x' + i.toString(16).padStart(40, '0'),
    timestamp: 1_710_000_000 + i,
    mevType: (['sandwich', 'arb', 'jit', 'liquidation', 'normal'] as const)[i % 5],
  }));
  useLiveStore.getState().reset();
  useLiveStore.getState().init({ mempool: entries });
}

beforeEach(() => {
  seedMempool(15);
});

describe('RecentSamples', () => {
  it('shows at most 10 samples (the rest are dropped)', () => {
    render(<RecentSamples />);
    expect(screen.getAllByTestId(/^recent-sample-/).length).toBe(10);
  });

  it('shows the truncated display hash for the first sample', () => {
    render(<RecentSamples />);
    const first = screen.getByTestId('recent-sample-0');
    expect(first.textContent).toMatch(/0x[0-9a-f]{6}/);
  });

  it('renders an empty-state placeholder when there is no data', () => {
    useLiveStore.getState().reset();
    useLiveStore.getState().init({ mempool: [] });
    render(<RecentSamples />);
    expect(screen.getByText(/暂无/)).toBeInTheDocument();
  });
});
