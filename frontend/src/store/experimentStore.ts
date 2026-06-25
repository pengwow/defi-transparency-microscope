/**
 * Experiment store — drives the Experiments page.
 *
 * Holds the catalog of scenarios, the currently-opened one, the live
 * parameter overrides, and the step counter used to walk through a
 * multi-run simulation.
 */

import { create } from 'zustand';
import type { ExperimentConfig } from '@/types';
import type { ExperimentPreset } from '@/services/api';

export type ParamValue = bigint | number | string | boolean | undefined;

export interface ExperimentState {
  scenarios: ExperimentPreset[];
  opened: ExperimentPreset | null;
  /** Live overrides for the opened scenario. */
  parameters: Partial<ExperimentConfig>;
  step: number;
  loadList: (s: ExperimentPreset[]) => void;
  open: (id: string) => void;
  setParam: <K extends keyof ExperimentConfig>(k: K, v: ExperimentConfig[K]) => void;
  nextStep: () => void;
  reset: () => void;
}

export const useExperimentStore = create<ExperimentState>((set, get) => ({
  scenarios: [],
  opened: null,
  parameters: {},
  step: 0,
  loadList: (scenarios) => set({ scenarios }),
  open: (id) => {
    const found = get().scenarios.find((s) => s.id === id);
    if (!found) throw new Error(`UNKNOWN_SCENARIO: ${id}`);
    set({
      opened: found,
      parameters: { ...found.config },
      step: 0,
    });
  },
  setParam: (k, v) =>
    set((s) => ({
      parameters: { ...s.parameters, [k]: v },
      step: 0,
    })),
  nextStep: () =>
    set((s) => {
      const runs = (s.parameters.runs as number | undefined) ?? s.opened?.config.runs ?? 1;
      const cap = Math.max(0, runs - 1);
      return { step: Math.min(s.step + 1, cap) };
    }),
  reset: () => set({ scenarios: [], opened: null, parameters: {}, step: 0 }),
}));
