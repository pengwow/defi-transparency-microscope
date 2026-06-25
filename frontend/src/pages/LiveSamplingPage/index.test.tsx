/**
 * Tests for the real LiveSamplingPage (Task 18).
 *
 * Verifies the page renders the three-column layout, the AMM canvas,
 * the sandwich feed, and the inspector.  Uses a stub for the MockAPI
 * and the canvas hook to avoid JSDOM canvas noise.
 */

import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

// Stub the useCanvas hook to return a plain ref so we don't need rAF.
vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

import { LiveSamplingPage } from './index';
import { useLiveStore } from '@/store/liveStore';

beforeEach(() => {
  useLiveStore.getState().reset();
  useLiveStore.getState().init({
    mempool: [
      { hash: '0xa', from: '0xfrom-a', timestamp: 1_700_000_000, mevType: 'sandwich' },
      { hash: '0xb', from: '0xfrom-b', timestamp: 1_700_000_010, mevType: 'normal' },
      { hash: '0xc', from: '0xfrom-c', timestamp: 1_700_000_020, mevType: 'arb' },
    ],
    ammPriceE18: 2000n * 10n ** 18n,
    cumulativeMevWei: 0n,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LiveSamplingPage (real)', () => {
  it('renders the three panels with the expected testIds', async () => {
    render(<LiveSamplingPage />);
    await waitFor(() => {
      expect(screen.getByTestId('amm-curve-panel')).toBeInTheDocument();
      expect(screen.getByTestId('sandwich-feed-panel')).toBeInTheDocument();
      expect(screen.getByTestId('inspector-panel')).toBeInTheDocument();
    });
  });

  it('shows the seeded mempool rows in the feed', async () => {
    render(<LiveSamplingPage />);
    await waitFor(() => {
      const feed = screen.getByTestId('sandwich-feed-panel');
      expect(feed.textContent).toContain('SANDWICH');
      expect(feed.textContent).toContain('NORMAL');
      expect(feed.textContent).toContain('ARB');
    });
  });

  it('selects a row when clicked (active state updates)', async () => {
    render(<LiveSamplingPage />);
    // Wait for the feed to be populated with rows.
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /SANDWICH|NORMAL|ARB|JIT|LIQ/ }).length).toBeGreaterThan(0);
    });
    const rows = screen.getAllByRole('button', { name: /SANDWICH|NORMAL|ARB|JIT|LIQ/ });
    expect(rows[0].getAttribute('data-active')).toBe('false');
    fireEvent.click(rows[0]);
    await waitFor(() => {
      expect(rows[0].getAttribute('data-active')).toBe('true');
    });
  });

  it('pushes a new mempool entry on the setInterval tick', async () => {
    render(<LiveSamplingPage />);
    // Wait for the page to finish its initial data load (allTxs is populated
    // and the setInterval has been registered).
    await waitFor(
      () => {
        expect(screen.getByTestId('amm-curve-panel')).toBeInTheDocument();
        // Use the live store mutation as a proxy: the page's effect for the
        // interval only registers once allTxs is non-empty, which happens
        // just after the first setAllTxs in the test environment.
      },
      { timeout: 4000 },
    );
    // Wait until the interval has been set up by polling the mempool count.
    const before = useLiveStore.getState().mempool.length;
    // Use real timers + a small real wait so the interval definitely fires.
    await new Promise((r) => setTimeout(r, 1700));
    const after = useLiveStore.getState().mempool.length;
    expect(after).toBe(before + 1);
  });
});
