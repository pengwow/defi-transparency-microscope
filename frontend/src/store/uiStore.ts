/**
 * UI store — global chrome state.
 *
 * Holds the active page, mode, the running list of alerts, a single
 * loading flag, and (in Batch 3) the demo's flash alert, lens stage,
 * demo run state, and current block number.  Components subscribe to
 * the slices they care about (e.g. `useUiStore((s) => s.page)`) to
 * avoid re-renders when unrelated fields change.
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

/** The 4 stages of the demo's microscope-loading animation. */
export type LensStage = 'idle' | 'capture' | 'fork' | 'parse' | 'ready' | 'zooming';

/** Categories of flash alerts the demo pushes at the user. */
export type FlashType = 'sandwich' | 'jit' | 'liquidation';

export interface FlashAlertPayload {
  type: FlashType;
  title: string;
  body: string;
}

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

  /** Single demo flash alert (the most recent one).  Null when none. */
  flashAlert: FlashAlertPayload | null;
  /** Current stage of the demo's microscope-loading animation. */
  lensStage: LensStage;
  /** Whether the 一键实验 demo run is currently active. */
  demoRunning: boolean;
  /** Current step of the demo run, advanced via advanceDemo(). */
  demoStep: number;
  /** Current block number, ticked by the realtime clock widget. */
  blockNumber: number;

  setPage: (p: Page) => void;
  setMode: (m: Mode) => void;
  pushAlert: (a: Omit<Alert, 'id' | 'ts'>) => void;
  clearAlerts: () => void;
  setLoading: (b: boolean) => void;

  pushFlashAlert: (a: FlashAlertPayload) => void;
  dismissFlashAlert: () => void;
  setLensStage: (s: LensStage) => void;

  startDemo: () => void;
  advanceDemo: () => void;
  stopDemo: () => void;

  setBlockNumber: (n: number) => void;
}

let alertSeq = 0;

/** Default block number used by the realtime clock (Eth mainnet-ish). */
const DEFAULT_BLOCK_NUMBER = 22_180_542;

export const useUiStore = create<UiState>((set) => ({
  page: 'dashboard',
  mode: 'live',
  alerts: [],
  loading: false,
  flashAlert: null,
  lensStage: 'idle',
  demoRunning: false,
  demoStep: 0,
  blockNumber: DEFAULT_BLOCK_NUMBER,

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

  pushFlashAlert: (a) => set({ flashAlert: a }),
  dismissFlashAlert: () => set({ flashAlert: null }),
  setLensStage: (s) => set({ lensStage: s }),

  startDemo: () => set({ demoRunning: true, demoStep: 0 }),
  advanceDemo: () => set((s) => ({ demoStep: s.demoStep + 1 })),
  stopDemo: () => set({ demoRunning: false, demoStep: 0, flashAlert: null }),

  setBlockNumber: (n) => set({ blockNumber: n }),
}));
