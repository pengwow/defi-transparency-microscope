/**
 * UI store — global chrome state.
 *
 * Holds the active page, mode, the running list of alerts, and a single
 * loading flag.  Components subscribe to the slices they care about
 * (e.g. `useUiStore((s) => s.page)`) to avoid re-renders when
 * unrelated fields change.
 */

import { create } from 'zustand';

export type Page =
  | 'dashboard'
  | 'mempool'
  | 'transactions'
  | 'lending'
  | 'positions'
  | 'experiments'
  | 'settings';

export type Mode = 'live' | 'replay';

export interface Alert {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  ts: number;
}

export interface UiState {
  page: Page;
  mode: Mode;
  alerts: Alert[];
  loading: boolean;
  setPage: (p: Page) => void;
  setMode: (m: Mode) => void;
  pushAlert: (a: Omit<Alert, 'id' | 'ts'>) => void;
  clearAlerts: () => void;
  setLoading: (b: boolean) => void;
}

let alertSeq = 0;

export const useUiStore = create<UiState>((set) => ({
  page: 'dashboard',
  mode: 'live',
  alerts: [],
  loading: false,
  setPage: (page) => set({ page }),
  setMode: (mode) => set({ mode }),
  pushAlert: (a) =>
    set((s) => ({
      alerts: [
        ...s.alerts,
        { ...a, id: `a${++alertSeq}`, ts: Date.now() },
      ],
    })),
  clearAlerts: () => set({ alerts: [] }),
  setLoading: (loading) => set({ loading }),
}));
