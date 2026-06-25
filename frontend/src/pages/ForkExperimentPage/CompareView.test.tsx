/**
 * Tests for the CompareView component.
 *
 * Verifies the 3-branch comparison table renders the baseline,
 * victim-only, and attacker-present columns, and shows numeric
 * values for the key metrics.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { CompareView } from './CompareView';
import type { ExperimentPreset } from '@/services/api';

afterEach(() => {
  cleanup();
});

function makePreset(): ExperimentPreset {
  return {
    id: 'sandwich-eth-usdc',
    name: 'Sandwich: ETH/USDC',
    description: 'desc',
    config: {
      name: 'Sandwich: ETH/USDC',
      protocol: 'uniswap_v2',
      reserve0: 80_000n * 10n ** 18n,
      reserve1: 160_000_000n * 10n ** 6n,
      fee: 3000,
      runs: 50,
    },
  };
}

describe('CompareView', () => {
  it('renders the three branch column headers', async () => {
    render(<CompareView scenario={makePreset()} />);
    await waitFor(() => {
      // The <thead> contains exactly three branch column headers.
      const headers = screen.getAllByRole('columnheader');
      const headerTexts = headers.map((h) => h.textContent?.trim());
      expect(headerTexts).toContain('Baseline');
      expect(headerTexts).toContain('Victim-only');
      expect(headerTexts).toContain('Attacker-present');
    });
  });

  it('renders the scenario name', async () => {
    render(<CompareView scenario={makePreset()} />);
    await waitFor(() => {
      expect(screen.getByText('Sandwich: ETH/USDC')).toBeInTheDocument();
    });
  });

  it('renders currency-formatted values in the comparison table', async () => {
    render(<CompareView scenario={makePreset()} />);
    await waitFor(() => {
      const table = screen.getByRole('table');
      expect(table.textContent).toMatch(/\$[\d,.]+/);
    });
  });

  it('renders the victim amount in row', async () => {
    render(<CompareView scenario={makePreset()} />);
    await waitFor(() => {
      expect(screen.getByText('Victim amount in')).toBeInTheDocument();
    });
  });
});
