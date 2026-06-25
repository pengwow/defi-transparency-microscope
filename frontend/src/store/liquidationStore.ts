/**
 * Liquidation store — the panorama / focus dual-view state for the
 * Liquidation page.
 *
 * Holds:
 *   - `liqMode`        — current mode ('panorama' | 'focus')
 *   - `focusAddress`   — the address currently inspected (focus mode)
 *   - `sliders`        — 5 simulation sliders (collateral, debt,
 *                        price, bonus, ltv) used to drive the
 *                        sub-computations on the focus panel
 *   - `redAlert`       — conditional top-of-page alert banner
 *                        (null when not active)
 *   - `heatmaps`       — sparse cell list for the panorama heatmap
 *   - `positions`      — cached lending positions (optional)
 */

import { create } from 'zustand';
import type { LendingPosition } from '@/types';
import type { LiquidationCell } from '@/canvas/LiquidationHeatmap';

export type LiqMode = 'panorama' | 'focus';

export interface Sliders {
  /** ETH collateral amount. */
  collateral: number;
  /** Borrowed USDC amount. */
  debt: number;
  /** Current ETH price (USD). */
  price: number;
  /** Liquidation bonus (%). */
  bonus: number;
  /** LTV upper bound (0..1). */
  ltv: number;
}

export interface RedAlert {
  active: boolean;
  title: string;
  desc: string;
}

export interface LiquidationState {
  liqMode: LiqMode;
  focusAddress: string;
  sliders: Sliders;
  redAlert: RedAlert | null;
  heatmaps: LiquidationCell[];
  positions: LendingPosition[];

  setLiqMode: (m: LiqMode) => void;
  setFocusAddress: (a: string) => void;
  setSlider: <K extends keyof Sliders>(key: K, val: Sliders[K]) => void;
  setRedAlert: (payload: RedAlert) => void;
  dismissRedAlert: () => void;
  setHeatmaps: (cells: LiquidationCell[]) => void;
  setPositions: (p: LendingPosition[]) => void;
  reset: () => void;
}

const DEFAULT_SLIDERS: Sliders = {
  collateral: 10,
  debt: 5000,
  price: 2400,
  bonus: 5,
  ltv: 0.8,
};

export const useLiquidationStore = create<LiquidationState>((set) => ({
  liqMode: 'panorama',
  focusAddress: '0x1234...5678',
  sliders: { ...DEFAULT_SLIDERS },
  redAlert: null,
  heatmaps: [],
  positions: [],

  setLiqMode: (liqMode) => set({ liqMode }),
  setFocusAddress: (focusAddress) => set({ focusAddress }),
  setSlider: (key, val) =>
    set((s) => ({ sliders: { ...s.sliders, [key]: val } })),
  setRedAlert: (redAlert) => set({ redAlert }),
  dismissRedAlert: () => set({ redAlert: null }),
  setHeatmaps: (heatmaps) => set({ heatmaps }),
  setPositions: (positions) => set({ positions }),

  reset: () =>
    set({
      liqMode: 'panorama',
      focusAddress: '0x1234...5678',
      sliders: { ...DEFAULT_SLIDERS },
      redAlert: null,
      heatmaps: [],
      positions: [],
    }),
}));
