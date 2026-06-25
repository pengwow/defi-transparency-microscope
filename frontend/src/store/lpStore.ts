/**
 * LP/IL microscope store — the V2/V3 toggle + 4 parameter sliders
 * that drive the LP/IL tab's panels.
 *
 * State:
 *   - version        'v2' | 'v3'                       (default 'v2')
 *   - priceRatio     multiplicative price ratio r      (default 1.0, clamped 0.1..10)
 *   - concentration  V3 ±range around the current tick (default 0)
 *   - fee            LP fee tier, in percent           (default 0.3)
 *   - depositUsd     notional deposit in USD           (default 10000)
 *
 * Actions:
 *   - setVersion, setPriceRatio, setConcentration, setFee, setDepositUsd, reset
 */

import { create } from 'zustand';

export type LpVersion = 'v2' | 'v3';

export interface LpState {
  version: LpVersion;
  priceRatio: number;
  concentration: number;
  fee: number;
  depositUsd: number;

  setVersion: (v: LpVersion) => void;
  setPriceRatio: (p: number) => void;
  setConcentration: (c: number) => void;
  setFee: (f: number) => void;
  setDepositUsd: (d: number) => void;
  reset: () => void;
}

const PRICE_RATIO_MIN = 0.1;
const PRICE_RATIO_MAX = 10;

const DEFAULT_STATE: Pick<LpState, 'version' | 'priceRatio' | 'concentration' | 'fee' | 'depositUsd'> = {
  version: 'v2',
  priceRatio: 1.0,
  concentration: 0,
  fee: 0.3,
  depositUsd: 10000,
};

function clampPriceRatio(p: number): number {
  if (!Number.isFinite(p)) return PRICE_RATIO_MIN;
  if (p < PRICE_RATIO_MIN) return PRICE_RATIO_MIN;
  if (p > PRICE_RATIO_MAX) return PRICE_RATIO_MAX;
  return p;
}

export const useLpStore = create<LpState>((set) => ({
  ...DEFAULT_STATE,

  setVersion: (version) => set({ version }),
  setPriceRatio: (p) => set({ priceRatio: clampPriceRatio(p) }),
  setConcentration: (concentration) => set({ concentration }),
  setFee: (fee) => set({ fee }),
  setDepositUsd: (depositUsd) => set({ depositUsd }),

  reset: () => set({ ...DEFAULT_STATE }),
}));
