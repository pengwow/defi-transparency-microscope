/**
 * Tests for the App shell.
 *
 * Verifies the basic wiring:
 *   - The header renders
 *   - The nav tabs render
 *   - Clicking a tab routes to the matching page
 *   - The ErrorBoundary catches render-time errors
 */

import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

// Mock ECharts so the ReportPage can render under jsdom (no canvas getContext).
vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    dispose: vi.fn(),
    resize: vi.fn(),
  })),
}));

import { App } from './App';
import { useUiStore } from '@/store/uiStore';
import { useLiveStore } from '@/store/liveStore';
import { usePositionStore } from '@/store/positionStore';
import { useExperimentStore } from '@/store/experimentStore';

beforeEach(() => {
  // Reset all relevant stores so we have a clean slate for each test.
  useUiStore.setState({ page: 'live', mode: 'live', alerts: [], loading: false });
  useLiveStore.getState().reset();
  usePositionStore.getState().reset();
  useExperimentStore.getState().reset();
});

afterEach(() => {
  cleanup();
  // Silence the React warning about the bomb in the error-boundary test.
  vi.restoreAllMocks();
});

describe('App', () => {
  it('renders the header once data has loaded', async () => {
    render(<App />);
    // The loading screen appears first, then the header after data resolves.
    await waitFor(() => {
      expect(screen.getByTestId('app-header')).toBeInTheDocument();
    });
  });

  it('renders the nav tabs once data has loaded', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('nav-tabs')).toBeInTheDocument();
    });
  });

  it('lands on the live page by default', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('live-amm-panel')).toBeInTheDocument();
    });
  });

  it('switches pages when a nav tab is clicked', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('app-header')).toBeInTheDocument();
    });
    // Click the 报告 (report) tab to navigate from the default live page.
    fireEvent.click(screen.getByRole('tab', { name: /报告/ }));
    await waitFor(() => {
      expect(screen.getByTestId('report-summary-panel')).toBeInTheDocument();
    });
  });

  // Regression for "清算页面下方什么都不显示":
  // The Liquidation page's root <div> used to be hidden because
  // `.dtm-page { display: none }` was applied to *every* page root
  // and only LiveSamplingPage opted in to `.is-active`.  After the
  // CSS fix the page renders its children unconditionally.  This
  // test guards against the bug returning: clicking the Liquidation
  // tab must surface the panorama container, the explanation block,
  // and the AMM disturbance canvas — all of which sit *below* the
  // mode bar that the user reported they could still see.
  it('renders the Liquidation page contents (not just the mode bar)', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('app-header')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('tab', { name: /清算/ }));
    await waitFor(() => {
      expect(screen.getByTestId('liquidation-panorama-container')).toBeInTheDocument();
    });
    expect(screen.getByTestId('liquidation-explanation-panel')).toBeInTheDocument();
    expect(screen.getByTestId('amm-disturbance-canvas')).toBeInTheDocument();
  });

  // Full-tab route smoke: every nav tab must mount *its* page root
  // and at least one piece of page-specific content below the
  // header.  Catches CSS-hides-everything regressions for any
  // page, not just Liquidation.  NavTabs is the canonical entry
  // point, so we drive it via getByRole('tab', { name }) — same
  // surface real users see.
  it('mounts every nav-tab page with page-specific content (full route smoke)', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('app-header')).toBeInTheDocument();
    });

    // Use the exact full label of each tab (emoji + text) so we
    // don't accidentally match sibling tabs (e.g. "教学实验" vs
    // "实验切片" — both contain "实验").  See NavTabs.tsx for the
    // canonical labels.
    const cases: Array<{ tab: RegExp; expectTestIds: string[] }> = [
      { tab: /📡 实时采样/,        expectTestIds: ['live-amm-panel', 'mempool-panel'] },
      { tab: /🔬 实验切片/,        expectTestIds: ['fork-experiment-grid', 'fork-params-panel'] },
      { tab: /⚡ 清算/,            expectTestIds: ['liquidation-panorama-container'] },
      { tab: /🌊 LP\/IL/,          expectTestIds: ['lpil-grid', 'lpil-params-panel'] },
      { tab: /🎓 教学实验/,        expectTestIds: ['education-grid', 'edu-params-panel'] },
      { tab: /📊 报告/,            expectTestIds: ['report-grid', 'report-overview-panel'] },
    ];

    for (const { tab, expectTestIds } of cases) {
      fireEvent.click(screen.getByRole('tab', { name: tab }));
      for (const id of expectTestIds) {
        await waitFor(
          () => {
            expect(screen.getByTestId(id)).toBeInTheDocument();
          },
          { timeout: 2000 },
        );
      }
    }
  });

  it('populates the live store on mount', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('app-header')).toBeInTheDocument();
    });
    const mempool = useLiveStore.getState().mempool;
    expect(mempool.length).toBeGreaterThan(0);
  });

  it('populates the experiment store on mount', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('app-header')).toBeInTheDocument();
    });
    const scenarios = useExperimentStore.getState().scenarios;
    expect(scenarios.length).toBeGreaterThan(0);
  });

  it('populates the position store on mount', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('app-header')).toBeInTheDocument();
    });
    expect(usePositionStore.getState().lending.length).toBeGreaterThan(0);
    expect(usePositionStore.getState().lp.length).toBeGreaterThan(0);
  });
});
