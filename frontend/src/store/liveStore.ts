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
  init: (seed: {
    mempool?: MempoolEntry[];
    ammPriceE18?: bigint;
    cumulativeMevWei?: bigint;
  }) => void;
  pushTx: (tx: MempoolEntry) => void;
  setAmmPrice: (p: bigint) => void;
  reset: () => void;
}

export const useLiveStore = create<LiveState>((set) => ({
  mempool: [],
  ammPriceE18: 0n,
  cumulativeMevWei: 0n,
  init: ({ mempool = [], ammPriceE18 = 0n, cumulativeMevWei = 0n }) =>
    set({ mempool, ammPriceE18, cumulativeMevWei }),
  pushTx: (tx) => set((s) => ({ mempool: [...s.mempool, tx] })),
  setAmmPrice: (ammPriceE18) => set({ ammPriceE18 }),
  reset: () => set({ mempool: [], ammPriceE18: 0n, cumulativeMevWei: 0n }),
}));

// Keep the import as type-only so the bundler tree-shakes the runtime.
export type _Tx = MockTransaction;
