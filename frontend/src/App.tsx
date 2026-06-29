/**
 * App — top-level shell.
 *
 * Wires together:
 *   1. Initial data load (live store, position store, experiment store)
 *   2. The full demo chrome: ParticleBackground + LensTransition
 *   3. The Header (with 一键实验 pill) / NavTabs / page router
 *   4. The ModeBar in the header right slot
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
  DemoOverlay,
} from '@/components/common';
import { useExperimentStore } from '@/store/experimentStore';
import { useLiveStore } from '@/store/liveStore';
import { usePositionStore } from '@/store/positionStore';
import { useUiStore, type Page } from '@/store/uiStore';
import { currentAPI, currentWSClient, backendConfig } from '@/services';
import { runDemo, type DemoKind } from '@/services/demoScript';
import { spotPriceE18 } from '@/algorithms/cpmm';
import { EducationPage } from '@/pages/EducationPage';
import { ForkExperimentPage } from '@/pages/ForkExperimentPage';
import { LiquidationPage } from '@/pages/LiquidationPage';
import { LpIlPage } from '@/pages/LpIlPage';
import { LiveSamplingPage } from '@/pages/LiveSamplingPage';
import { ReportPage } from '@/pages/ReportPage';

const api = currentAPI;

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

  // Switching the ModeBar to "Fork 实验切片" should also drop the
  // user onto the Fork tab so the mode toggle feels like a real
  // navigation, not a no-op state change.
  const handleModeChange = (next: 'live' | 'replay') => {
    setMode(next);
    if (next === 'replay') {
      setPage('fork');
    } else {
      setPage('live');
    }
  };

  // Initial data load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // When the developer has set `VITE_USE_BACKEND=true`, do a
      // cheap `/api/v1/health` probe first so we can surface a
      // human-readable error if the backend is not actually
      // listening.  Without this, the only signal is a swarm of
      // opaque CORS errors in the browser console.
      if (backendConfig.useBackend) {
        try {
          const healthUrl = `${backendConfig.baseUrl}/api/v1/health`;
          const r = await fetch(healthUrl, { method: 'GET' });
          if (!r.ok) {
            throw new Error(`HTTP ${r.status}`);
          }
        } catch (err) {
          if (cancelled) return;
          const detail = (err as Error).message || 'unreachable';
          // eslint-disable-next-line no-console
          console.error(
            `[dtm-frontend] backend health probe failed at ${backendConfig.baseUrl}/api/v1/health — ${detail}.\n` +
              `  Most likely causes:\n` +
              `    1. The FastAPI server is not running (start with \`uv run dtm-backend\` or \`./scripts/dev.sh\`).\n` +
              `    2. VITE_BACKEND_URL (${backendConfig.baseUrl}) does not match the server's bind address.\n` +
              `  If both are correct, check the CORS allow-list in the backend config — the default covers 5173/4173/5174/5175/3000/8080.`,
          );
          useUiStore.getState().pushAlert({
            level: 'error',
            message: `Backend unreachable: ${backendConfig.baseUrl}`,
          });
          setReady(true);
          return;
        }
      }
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

  // Wire the live WS client (only present in backend mode) to the
  // live store.  In mock mode the demo script drives the store.
  useEffect(() => {
    if (!currentWSClient) return;
    const ws = currentWSClient;
    // Mark the store as backend-connected up front; the polling
    // effect below will flip it back to false if the socket
    // drops.
    useLiveStore.getState().setBackendConnected(ws.getState() === 'open');
    // Subscribe to the topics that the UI cares about.
    ws.subscribe(['mempool', 'liquidation_event', 'amm_sync']);

    // Hook the onMessage stream to the live store.
    const onMsg = (msg: { type: string; data: unknown }) => {
      if (msg.type === 'mempool_tx') {
        const d = msg.data as {
          hash: string;
          from: string;
          timestamp: number;
          type: 'normal' | 'sandwich' | 'arbitrage' | 'jit' | 'liquidation';
        };
        useLiveStore.getState().pushTx({
          hash: d.hash,
          from: d.from,
          timestamp: d.timestamp,
          mevType: d.type === 'arbitrage' ? 'arb' : (d.type as never),
        });
      } else if (msg.type === 'liquidation_event') {
        const d = msg.data as { profit: string | bigint };
        const profit = typeof d.profit === 'string' ? BigInt(d.profit) : d.profit;
        useLiveStore.setState((s) => ({
          cumulativeMevWei: s.cumulativeMevWei + profit,
        }));
      } else if (msg.type === 'amm_sync') {
        // amm_sync is a V2 Sync / V3 Swap reduction; the live store
        // stores a single 1e18-fixed-point price.  For V2 we can
        // recompute via CPMM; for V3 the wire doesn't carry enough
        // info to recompute, so we leave the price as-is.
        const d = msg.data as {
          pool: string;
          reserve0: string | bigint;
          reserve1: string | bigint;
        };
        const r0 = typeof d.reserve0 === 'string' ? BigInt(d.reserve0) : d.reserve0;
        const r1 = typeof d.reserve1 === 'string' ? BigInt(d.reserve1) : d.reserve1;
        try {
          // spotPriceE18(r0, r1) returns bigint 1e18. Only update if
          // both reserves are non-zero (sanity).
          if (r0 > 0n && r1 > 0n) {
            // We can't recompute precisely without a token-decimals
            // table; use a 1e18-scaled ratio.  This is good enough
            // for the live UI's "price changed" indicator.
            const scaled = (r1 * 10n ** 18n) / r0;
            useLiveStore.getState().setAmmPrice(scaled);
          }
        } catch {
          /* ignore malformed amm_sync */
        }
      }
    };
    // Attach the message handler via the public setter.
    ws.setOnMessage(onMsg);
    ws.start();

    // Poll the WS client's `getState()` once a second and
    // mirror it into the live store so the UI badge can flip
    // between "Backend: live" and "Backend: reconnecting…"
    // without waiting for a fresh message.
    const id = window.setInterval(() => {
      useLiveStore.getState().setBackendConnected(ws.getState() === 'open');
    }, 1000);

    return () => {
      window.clearInterval(id);
      ws.stop();
      ws.setOnMessage(null);
      useLiveStore.getState().setBackendConnected(false);
    };
  }, []);

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
            right={<ModeBar value={mode} onChange={handleModeChange} />}
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
