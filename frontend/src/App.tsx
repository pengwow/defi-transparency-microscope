/**
 * App — top-level shell.
 *
 * Wires together:
 *   1. Initial data load (live store, position store, experiment store)
 *   2. The full demo chrome: ParticleBackground + LensTransition
 *   3. The Header (with 一键实验 pill) / NavTabs / page router
 *   4. The floating RealtimeClock + ModeBar in the header right slot
 *   5. The FlashAlert overlay with "放入显微镜" action
 *   6. An ErrorBoundary wrapping the whole tree
 *
 * The data layer is the in-memory `MockAPI` for now; swapping to a
 * real RPC-backed implementation means changing only the import.
 */

import { useEffect, useState } from 'react';
import {
  ErrorBoundary,
  FlashAlert,
  Header,
  LensTransition,
  ModeBar,
  NavTabs,
  ParticleBackground,
  RealtimeClock,
  DemoOverlay,
} from '@/components/common';
import { useExperimentStore } from '@/store/experimentStore';
import { useLiveStore } from '@/store/liveStore';
import { usePositionStore } from '@/store/positionStore';
import { useUiStore, type Page } from '@/store/uiStore';
import { MockAPI } from '@/services/mockApi';
import { runDemo, type DemoKind } from '@/services/demoScript';
import { spotPriceE18 } from '@/algorithms/cpmm';
import { EducationPage } from '@/pages/EducationPage';
import { ForkExperimentPage } from '@/pages/ForkExperimentPage';
import { LiquidationPage } from '@/pages/LiquidationPage';
import { LpIlPage } from '@/pages/LpIlPage';
import { LiveSamplingPage } from '@/pages/LiveSamplingPage';
import { ReportPage } from '@/pages/ReportPage';

const api = new MockAPI();

/** Maps the canonical Page enum to a React component. */
const PAGES: Record<Page, () => JSX.Element> = {
  live: LiveSamplingPage,
  fork: ForkExperimentPage,
  liquidation: LiquidationPage,
  lpil: LpIlPage,
  edu: EducationPage,
  report: ReportPage,
  settings: ReportPage, // unmapped — fall back to the report.
};

export function App() {
  const page = useUiStore((s) => s.page);
  const mode = useUiStore((s) => s.mode);
  const demoRunning = useUiStore((s) => s.demoRunning);
  const setMode = useUiStore((s) => s.setMode);
  const setPage = useUiStore((s) => s.setPage);
  const [ready, setReady] = useState(false);

  // Initial data load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pools, txs, lending, lp, experiments] = await Promise.all([
        api.listPools(),
        api.listTransactions(),
        api.listLendingPositions(),
        api.listLpPositions(),
        api.listExperiments(),
      ]);
      if (cancelled) return;
      // Pick a stable canonical pool (ETH/USDC) for the AMM price snapshot.
      const livePool =
        pools.find((p) => p.token0.symbol === 'ETH' && p.token1.symbol === 'USDC') ??
        pools[0];
      useLiveStore.getState().init({
        mempool: txs.map((t) => ({
          hash: t.hash,
          from: t.from,
          timestamp: t.timestamp,
          mevType: t.mevType,
        })),
        ammPriceE18: livePool ? spotPriceE18(livePool.reserve0, livePool.reserve1) : 0n,
        cumulativeMevWei: 0n,
      });
      usePositionStore.getState().setLending(lending);
      usePositionStore.getState().setLp(lp);
      useExperimentStore.getState().loadList(experiments);
      setReady(true);
    })().catch((err) => {
      // Surface load errors to the user.
      console.error('App: initial data load failed', err);
      useUiStore.getState().pushAlert({
        level: 'error',
        message: `Failed to load data: ${(err as Error).message}`,
      });
      // Even on error, mark the app as ready so the user can navigate.
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const runDemoHandler = (kind: DemoKind) => () => {
    void runDemo(kind);
  };

  const enterMicroscope = () => {
    void runDemo('microscope');
  };

  // While loading, just render the background (avoid the loading
  // screen which would be immediately covered by the particle field).
  if (!ready) {
    return <ParticleBackground />;
  }

  const CurrentPage = PAGES[page] ?? ReportPage;

  return (
    <ErrorBoundary>
      <ParticleBackground />
      <LensTransition>
        <div className="dtm-app" data-testid="app-root">
          <Header
            onStartDemo={runDemoHandler('auto')}
            demoRunning={demoRunning}
            right={
              <>
                <RealtimeClock />
                <ModeBar value={mode} onChange={setMode} />
              </>
            }
          />
          <NavTabs active={page} onSelect={setPage} />
          <main className="dtm-app-main" data-testid="app-main">
            <CurrentPage />
          </main>
          <FlashAlert onEnterMicroscope={enterMicroscope} />
          <DemoOverlay />
        </div>
      </LensTransition>
    </ErrorBoundary>
  );
}

export default App;
