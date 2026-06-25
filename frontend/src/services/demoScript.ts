/**
 * demoScript — orchestrated "一键实验" demo run.
 *
 * Phase 9 (Batch 11) implementation:
 *   - Two scripts: 'auto' (16s) and 'microscope' (3.5s)
 *   - Each script schedules a list of {atMs, action} entries
 *   - All timer handles are tracked in `demoTimers` and cleared
 *     before a new run starts, to avoid React 18 strict-mode double-
 *     mount accumulation
 *   - Each step bails out if `demoRunning` has flipped to false
 *     (so a manual stopDemo() also implicitly cancels the script)
 */

import { useUiStore } from '@/store/uiStore';

export type DemoKind = 'auto' | 'microscope';

interface DemoStep {
  atMs: number;
  action: () => void;
}

function advanceAndRun(fn: () => void): void {
  fn();
  useUiStore.getState().advanceDemo();
}

/** Variant for setup steps (atMs === 0): run the side effect but do
 *  NOT advance the demo counter.  The counter sits at 0 ("准备中…")
 *  until the first real progress event. */
function runSetup(fn: () => void): void {
  fn();
}

const AUTO_STEPS: DemoStep[] = [
  {
    atMs: 0,
    action: () => runSetup(() => useUiStore.getState().setPage('live')),
  },
  {
    atMs: 2000,
    action: () =>
      advanceAndRun(() =>
        useUiStore.getState().pushFlashAlert({
          type: 'sandwich',
          title: '🚨 采样到三明治！',
          body: '一笔 50 WETH 兑换被 front-run + back-run',
        }),
      ),
  },
  {
    atMs: 4000,
    action: () =>
      advanceAndRun(() => {
        useUiStore.getState().dismissFlashAlert();
        useUiStore.getState().setLensStage('capture');
      }),
  },
  {
    atMs: 5000,
    action: () => advanceAndRun(() => useUiStore.getState().setLensStage('fork')),
  },
  {
    atMs: 6000,
    action: () => advanceAndRun(() => useUiStore.getState().setLensStage('parse')),
  },
  {
    atMs: 7000,
    action: () => advanceAndRun(() => useUiStore.getState().setLensStage('ready')),
  },
  {
    atMs: 8500,
    action: () => advanceAndRun(() => useUiStore.getState().setLensStage('zooming')),
  },
  {
    atMs: 10500,
    action: () =>
      advanceAndRun(() => {
        useUiStore.getState().setLensStage('idle');
        useUiStore.getState().setPage('fork');
      }),
  },
  {
    atMs: 16000,
    action: () => useUiStore.getState().stopDemo(),
  },
];

const MICROSCOPE_STEPS: DemoStep[] = [
  {
    atMs: 0,
    action: () => runSetup(() => useUiStore.getState().dismissFlashAlert()),
  },
  {
    atMs: 100,
    action: () => advanceAndRun(() => useUiStore.getState().setLensStage('capture')),
  },
  {
    atMs: 800,
    action: () => advanceAndRun(() => useUiStore.getState().setLensStage('fork')),
  },
  {
    atMs: 1500,
    action: () => advanceAndRun(() => useUiStore.getState().setLensStage('parse')),
  },
  {
    atMs: 2200,
    action: () => advanceAndRun(() => useUiStore.getState().setLensStage('ready')),
  },
  {
    atMs: 2900,
    action: () => advanceAndRun(() => useUiStore.getState().setLensStage('zooming')),
  },
  {
    atMs: 3500,
    action: () =>
      advanceAndRun(() => {
        useUiStore.getState().setLensStage('idle');
        useUiStore.getState().setPage('fork');
      }),
  },
];

/** All currently-scheduled demo timer handles.  Cleared at the start
 *  of every `runDemo` call and on manual stopDemo() so timers never
 *  accumulate across runs (React 18 strict-mode safety). */
let demoTimers: ReturnType<typeof setTimeout>[] = [];

function clearDemoTimers(): void {
  for (const t of demoTimers) clearTimeout(t);
  demoTimers = [];
}

/**
 * Start the guided demo run.
 *
 *   runDemo('auto')       — 16s "key experiment" tour from live → fork
 *   runDemo('microscope') — 3.5s focused "place under microscope" flow
 *
 * Calling runDemo while a previous run is still active will cancel the
 * previous timers first so the two runs never interleave.
 */
export function runDemo(kind: DemoKind): void {
  clearDemoTimers();
  // Reset the demo state so the new run starts at step 0.
  useUiStore.getState().startDemo();
  const steps = kind === 'auto' ? AUTO_STEPS : MICROSCOPE_STEPS;
  for (const step of steps) {
    // 0ms steps run synchronously so the side effect (e.g. dismissing
    // the flash alert when the user clicks "放入显微镜") is visible
    // before any timer tick — otherwise React's event loop swallows
    // it until the next microtask.
    if (step.atMs === 0) {
      if (useUiStore.getState().demoRunning) {
        step.action();
      }
      continue;
    }
    const handle = setTimeout(() => {
      // Manual stopDemo() flips demoRunning to false; skip the side
      // effect in that case so we never override a user-initiated
      // stop.
      if (!useUiStore.getState().demoRunning) return;
      step.action();
    }, step.atMs);
    demoTimers.push(handle);
  }
}
