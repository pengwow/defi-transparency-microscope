/**
 * Tests for the real ForkExperimentPage (Task 19).
 */

import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ForkExperimentPage } from './index';
import { useExperimentStore } from '@/store/experimentStore';
import { useUiStore } from '@/store/uiStore';

vi.mock('@/services/mockApi', () => {
  return {
    MockAPI: class {
      async runSandwichExperiment() {
        return {
          config: {} as any,
          results: [
            { attackerProfit: 0.1, victimLoss: 0.05 },
            { attackerProfit: 0.12, victimLoss: 0.06 },
          ],
          summary: { attackerProfit: 0.11, victimLoss: 0.055, count: 2 },
          durationMs: 1,
        };
      }
      async runIlExperiment() {
        return {
          config: {} as any,
          results: [{ ilV2: 0.1, ilV3: 0.12, priceRatio: 1.5 }],
          summary: { ilV2: 0.1, ilV3: 0.12 },
          durationMs: 1,
        };
      }
      async runAttributionExperiment() {
        return {
          config: {} as any,
          results: [{ totalE18: 0.5, priceImpact: 0.3, fees: 0.1, gasCost: 0.05, rebates: 0 }],
          summary: { totalE18: 0.5 },
          durationMs: 1,
        };
      }
    },
  };
});

const SCENARIOS = [
  {
    id: 'a',
    name: 'Scenario A',
    description: 'first',
    config: { name: 'A', protocol: 'uniswap_v2' as const, reserve0: 1n, reserve1: 1n, fee: 3000, runs: 1 },
  },
  {
    id: 'b',
    name: 'Scenario B',
    description: 'second',
    config: { name: 'B', protocol: 'uniswap_v2' as const, reserve0: 1n, reserve1: 1n, fee: 3000, runs: 1 },
  },
];

beforeEach(() => {
  useUiStore.setState({ page: 'experiments', mode: 'live', alerts: [], loading: false });
  useExperimentStore.getState().reset();
  useExperimentStore.getState().loadList(SCENARIOS);
  useExperimentStore.getState().open('a');
});

afterEach(() => {
  cleanup();
});

describe('ForkExperimentPage (real)', () => {
  it('renders the scenario list and compare view panels', async () => {
    render(<ForkExperimentPage />);
    await waitFor(() => {
      expect(screen.getByTestId('scenario-list-panel')).toBeInTheDocument();
      expect(screen.getByTestId('compare-view-panel')).toBeInTheDocument();
    });
  });

  it('lists the seeded scenarios', async () => {
    render(<ForkExperimentPage />);
    await waitFor(() => {
      const panel = screen.getByTestId('scenario-list-panel');
      expect(panel.textContent).toContain('Scenario A');
      expect(panel.textContent).toContain('Scenario B');
    });
  });

  it('switches the opened scenario when a row is clicked', async () => {
    render(<ForkExperimentPage />);
    await waitFor(() => {
      expect(screen.getByTestId('scenario-list-items')).toBeInTheDocument();
    });
    const bButton = screen
      .getAllByRole('button')
      .find((b) => b.textContent?.includes('Scenario B'));
    if (bButton) {
      fireEvent.click(bButton);
      expect(useExperimentStore.getState().opened?.id).toBe('b');
    }
  });
});
