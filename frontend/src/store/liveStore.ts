/**
 * Live store — the "live mode" feed.
 *
 * Tracks:
 *   - the pending mempool (transactions that have been observed but not
 *     yet mined)
 *   - the current AMM price (in 1e18 fixed point)
 *   - the cumulative MEV extracted (in wei) since the session started
 *
 * The UI subscribes to slices of this store to drive the mempool panel
 * and the dashboard's MEV total.
 */

import { create } from 'zustand';
import type { MockTransaction, MevType } from '@/mocks/transactions';

export interface MempoolEntry {
  hash: string;
  from: string;
  timestamp: number;
  mevType: MevType;
}

export interface LiveState {
  mempool: MempoolEntry[];
  ammPriceE18: bigint;
  cumulativeMevWei: bigint;
  /**
   * Whether the frontend is currently receiving live data from a
   * real backend (true) or running in self-contained mock mode (false).
   * Drives the "Backend: live" / "Backend: demo" badge on the live
   * page so the user can tell fake data from real data at a glance.
   */
  backendConnected: boolean;
  init: (seed: {
    mempool?: MempoolEntry[];
    ammPriceE18?: bigint;
    cumulativeMevWei?: bigint;
    backendConnected?: boolean;
  }) => void;
  pushTx: (tx: MempoolEntry) => void;
  setAmmPrice: (p: bigint) => void;
  setBackendConnected: (b: boolean) => void;
  reset: () => void;
}

export const useLiveStore = create<LiveState>((set) => ({
  mempool: [],
  ammPriceE18: 0n,
  cumulativeMevWei: 0n,
  backendConnected: false,
  init: ({
    mempool = [],
    ammPriceE18 = 0n,
    cumulativeMevWei = 0n,
    backendConnected = false,
  }) => set({ mempool, ammPriceE18, cumulativeMevWei, backendConnected }),
  pushTx: (tx) => set((s) => ({ mempool: [...s.mempool, tx] })),
  setAmmPrice: (ammPriceE18) => set({ ammPriceE18 }),
  setBackendConnected: (backendConnected) => set({ backendConnected }),
  reset: () =>
    set({
      mempool: [],
      ammPriceE18: 0n,
      cumulativeMevWei: 0n,
      backendConnected: false,
    }),
}));

// Keep the import as type-only so the bundler tree-shakes the runtime.
export type _Tx = MockTransaction;
