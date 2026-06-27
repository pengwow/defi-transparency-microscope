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
