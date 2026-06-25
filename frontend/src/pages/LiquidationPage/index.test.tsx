/**
 * Tests for the real LiquidationPage (Task 20).
 */

import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';

vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

import { LiquidationPage } from './index';
import { usePositionStore } from '@/store/positionStore';
import { useUiStore } from '@/store/uiStore';

const POSITIONS = [
  {
    id: 'p1',
    owner: '0xowner1',
    protocol: 'aave_v3',
    timestamp: 1_700_000_000,
    collateral: { '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 100n * 10n ** 18n },
    debt: { '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 50_000n * 10n ** 6n },
    liquidationThresholdE18: 80_000n * 10n ** 18n,
  },
  {
    id: 'p2',
    owner: '0xowner2',
    protocol: 'aave_v3',
    timestamp: 1_700_000_000,
    collateral: { '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 50n * 10n ** 18n },
    debt: { '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 80_000n * 10n ** 6n },
    liquidationThresholdE18: 80_000n * 10n ** 18n,
  },
];

beforeEach(() => {
  useUiStore.setState({ page: 'liquidation', mode: 'live', alerts: [], loading: false });
  usePositionStore.getState().reset();
  usePositionStore.getState().setLending(POSITIONS);
});

afterEach(() => {
  cleanup();
});

describe('LiquidationPage (real)', () => {
  it('renders the three panels with the expected testIds', async () => {
    render(<LiquidationPage />);
    await waitFor(() => {
      expect(screen.getByTestId('positions-panel')).toBeInTheDocument();
      expect(screen.getByTestId('hf-chart-panel')).toBeInTheDocument();
      expect(screen.getByTestId('risk-gauge-panel')).toBeInTheDocument();
    });
  });

  it('lists the seeded positions', async () => {
    render(<LiquidationPage />);
    await waitFor(() => {
      const panel = screen.getByTestId('positions-panel');
      expect(panel.textContent).toContain('p1');
      expect(panel.textContent).toContain('p2');
    });
  });

  it('selects a position when its row is clicked', async () => {
    render(<LiquidationPage />);
    await waitFor(() => {
      expect(screen.getByTestId('positions-panel')).toBeInTheDocument();
    });
    const rows = screen.getAllByRole('button', { name: /p1|p2/ });
    fireEvent.click(rows[0]);
    await waitFor(() => {
      expect(rows[0].getAttribute('data-active')).toBe('true');
    });
  });
});
