/**
 * Edu store — drives the Education tab's scenario selector, three
 * parameter sliders, and step index.
 *
 * State:
 *   - activeScenario: 'sandwich' | 'jit' | 'arbitrage' | 'liquidation' | 'front-running'
 *                     (default 'sandwich')
 *   - sliders:        { swapSize, liquidity, gasPrice }
 *                     (defaults: 10 / 1000 / 50)
 *   - stepIndex:      number, 0-based (default 0)
 *
 * Actions:
 *   - setActiveScenario(s)
 *   - setSlider(key, val)
 *   - setStepIndex(i)
 *   - reset()
 */

import { create } from 'zustand';

export type EduScenario =
  | 'sandwich'
  | 'jit'
  | 'arbitrage'
  | 'liquidation'
  | 'front-running';

export const EDU_SCENARIOS: ReadonlyArray<EduScenario> = [
  'sandwich',
  'jit',
  'arbitrage',
  'liquidation',
  'front-running',
];

export type EduSliderKey = 'swapSize' | 'liquidity' | 'gasPrice';

export interface EduSliders {
  swapSize: number;
  liquidity: number;
  gasPrice: number;
}

export interface EduState {
  activeScenario: EduScenario;
  sliders: EduSliders;
  stepIndex: number;

  setActiveScenario: (s: EduScenario) => void;
  setSlider: (key: EduSliderKey, val: number) => void;
  setStepIndex: (i: number) => void;
  reset: () => void;
}

const DEFAULT_SLIDERS: EduSliders = {
  swapSize: 10,
  liquidity: 1000,
  gasPrice: 50,
};

const DEFAULT_STATE: Pick<EduState, 'activeScenario' | 'sliders' | 'stepIndex'> = {
  activeScenario: 'sandwich',
  sliders: { ...DEFAULT_SLIDERS },
  stepIndex: 0,
};

function clampNonNegative(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v;
}

export const useEduStore = create<EduState>((set) => ({
  ...DEFAULT_STATE,

  setActiveScenario: (s) => set({ activeScenario: s }),
  setSlider: (key, val) =>
    set((state) => ({
      sliders: { ...state.sliders, [key]: clampNonNegative(val) },
    })),
  setStepIndex: (i) => set({ stepIndex: i < 0 ? 0 : Math.floor(i) }),
  reset: () => set({ ...DEFAULT_STATE, sliders: { ...DEFAULT_SLIDERS } }),
}));
