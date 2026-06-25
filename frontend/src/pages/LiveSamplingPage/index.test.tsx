/**
 * Tests for the new 3-column LiveSamplingPage.
 *
 * Verifies the page renders all six demo-style panels and that the
 * ExplainBox banner carries the "实时采样模式" header.
 */

import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Stub the useCanvas hook so we don't need rAF in jsdom.
vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

import { LiveSamplingPage } from './index';
import { useLiveStore } from '@/store/liveStore';

beforeEach(() => {
  useLiveStore.getState().reset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LiveSamplingPage (3-column demo layout)', () => {
  it('renders the six demo-style panels', () => {
    render(<LiveSamplingPage />);
    expect(screen.getByTestId('mempool-panel')).toBeInTheDocument();
    expect(screen.getByTestId('mev-attribution-panel')).toBeInTheDocument();
    expect(screen.getByTestId('live-amm-panel')).toBeInTheDocument();
    expect(screen.getByTestId('live-pnl-panel')).toBeInTheDocument();
    expect(screen.getByTestId('network-status-panel')).toBeInTheDocument();
    expect(screen.getByTestId('recent-samples-panel')).toBeInTheDocument();
  });

  it('shows the live sampling explain banner with the expected header', () => {
    render(<LiveSamplingPage />);
    const explain = screen.getByTestId('live-sampling-explain');
    expect(explain.textContent).toContain('实时采样模式');
  });

  it('renders the MempoolLanes legend chips inside the mempool panel', () => {
    render(<LiveSamplingPage />);
    const panel = screen.getByTestId('mempool-panel');
    expect(panel.querySelector('[data-testid="mev-legend"]')).toBeTruthy();
  });
});
