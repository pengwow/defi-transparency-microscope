/**
 * Position store — wallet positions and their live price feed.
 *
 * Holds:
 *   - the lending positions owned by the connected wallet
 *   - the LP positions owned by the connected wallet
 *   - the connected wallet address
 *   - a token-address -> price map used to recompute health factor when
 *     a price tick fires
 */

import { create } from 'zustand';
import type { LendingPosition, Position } from '@/types';

export interface PositionState {
  lending: LendingPosition[];
  lp: Position[];
  selectedAddress: string | null;
  /** Token address -> price in 1e18 fixed point. */
  pricesE18: Record<string, bigint>;
  setLending: (l: LendingPosition[]) => void;
  setLp: (p: Position[]) => void;
  selectAddress: (a: string | null) => void;
  updatePrice: (token: string, priceE18: bigint) => void;
  reset: () => void;
}

export const usePositionStore = create<PositionState>((set) => ({
  lending: [],
  lp: [],
  selectedAddress: null,
  pricesE18: {},
  setLending: (lending) => set({ lending }),
  setLp: (lp) => set({ lp }),
  selectAddress: (selectedAddress) =>
    set({ selectedAddress: selectedAddress ? selectedAddress.replace(/^0x/i, '') : null }),
  updatePrice: (token, priceE18) =>
    set((s) => ({ pricesE18: { ...s.pricesE18, [token]: priceE18 } })),
  reset: () => set({ lending: [], lp: [], selectedAddress: null, pricesE18: {} }),
}));
