/**
 * Tests for the rewritten ForkExperimentPage (demo-style 3-col layout).
 *
 * Verifies that all 7 panels are present, the ExplainBox contains
 * "实验切片模式", and the 3-column grid renders correctly.
 */

import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { ForkExperimentPage } from './index';
import { useExperimentStore } from '@/store/experimentStore';
import { useUiStore } from '@/store/uiStore';

// Stub useCanvas to a no-op so jsdom doesn't have to provide a real
// 2D context for the ForkAmm / ForkSankey canvases.
vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

vi.mock('@/services/mockApi', () => {
  return {
    MockAPI: class {
      async runSandwichExperiment() {
        return {
          config: {} as unknown as Record<string, unknown>,
          results: [],
          summary: { attackerProfit: 0, victimLoss: 0, count: 0 },
          durationMs: 1,
        };
      }
      async runIlExperiment() {
        return {
          config: {} as unknown as Record<string, unknown>,
          results: [],
          summary: { ilV2: 0, ilV3: 0 },
          durationMs: 1,
        };
      }
      async runAttributionExperiment() {
        return {
          config: {} as unknown as Record<string, unknown>,
          results: [],
          summary: { totalE18: 0 },
          durationMs: 1,
        };
      }
    },
  };
});

beforeEach(() => {
  useUiStore.setState({ page: 'fork', mode: 'live', alerts: [], loading: false });
  useExperimentStore.getState().reset();
});

afterEach(() => {
  cleanup();
});

const EXPECTED_PANELS = [
  'fork-params-panel',
  'step-controls-panel',
  'fork-amm-panel',
  'fork-sankey-panel',
  'fork-timeline-panel',
  'quant-results-panel',
  'fork-conclusion-panel',
];

describe('ForkExperimentPage (3-column demo)', () => {
  it('renders all 7 panels', async () => {
    render(<ForkExperimentPage />);
    await waitFor(() => {
      for (const testId of EXPECTED_PANELS) {
        expect(screen.getByTestId(testId)).toBeInTheDocument();
      }
    });
  });

  it('renders the explain-box with the "实验切片模式" title', async () => {
    render(<ForkExperimentPage />);
    await waitFor(() => {
      expect(screen.getByText('实验切片模式')).toBeInTheDocument();
    });
  });

  it('renders the 3-column grid', async () => {
    render(<ForkExperimentPage />);
    await waitFor(() => {
      expect(screen.getByTestId('fork-experiment-grid')).toBeInTheDocument();
    });
  });

  it('renders the top-level page container', async () => {
    render(<ForkExperimentPage />);
    await waitFor(() => {
      expect(screen.getByTestId('fork-experiment-page')).toBeInTheDocument();
    });
  });
});
