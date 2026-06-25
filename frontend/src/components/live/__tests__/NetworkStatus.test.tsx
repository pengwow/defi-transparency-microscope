/**
 * Tests for the NetworkStatus panel.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NetworkStatus } from '../NetworkStatus';
import { useUiStore } from '@/store/uiStore';
import { useLiveStore } from '@/store/liveStore';

beforeEach(() => {
  useUiStore.getState().setBlockNumber(22_180_542);
  useLiveStore.getState().reset();
  useLiveStore.getState().init({
    mempool: [
      { hash: '0xa', from: '0x1', timestamp: 1, mevType: 'normal' },
      { hash: '0xb', from: '0x2', timestamp: 2, mevType: 'normal' },
      { hash: '0xc', from: '0x3', timestamp: 3, mevType: 'normal' },
    ],
  });
});

describe('NetworkStatus', () => {
  it('renders the four stat labels', () => {
    render(<NetworkStatus />);
    expect(screen.getByText(/区块高度/)).toBeInTheDocument();
    expect(screen.getByText(/Gas Price/)).toBeInTheDocument();
    expect(screen.getByText(/Mempool|待处理/)).toBeInTheDocument();
    expect(screen.getByText(/WS 延迟|延迟/)).toBeInTheDocument();
  });

  it('reflects the current block number from the UI store', () => {
    useUiStore.getState().setBlockNumber(99_000_000);
    render(<NetworkStatus />);
    expect(screen.getByTestId('network-status-block').textContent).toMatch(/99,?000,?000/);
  });

  it('shows the mempool size from the live store', () => {
    render(<NetworkStatus />);
    expect(screen.getByTestId('network-status-mempool').textContent).toMatch(/3/);
  });
});
