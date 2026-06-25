/**
 * DemoOverlay — bottom-center floating "一键实验" progress widget.
 *
 * Reads `demoRunning` and `demoStep` from `useUiStore` and, while a
 * demo is in flight, renders a translucent dark pill with a cyan →
 * purple progress bar, the human-readable step label, and a "跳过"
 * button that calls `stopDemo()`.
 *
 * The progress percentage is computed as `min(100, demoStep / 8 * 100)`
 * — auto's 8 progress events fill the bar; microscope (6 events) tops
 * out at 75%, which still reads as "mostly done".
 *
 * This component is purely presentational.  The state machine lives in
 * `services/demoScript.ts` and the UI store.
 */

import { useUiStore } from '@/store/uiStore';

const STEP_LABELS: Record<number, string> = {
  0: '准备中…',
  1: '捕获交易…',
  2: 'Fork 链…',
  3: '解析中…',
  4: '完成 ✅',
};

const MAX_STEPS_FOR_FULL_BAR = 8;

function stepLabelFor(step: number): string {
  if (step in STEP_LABELS) return STEP_LABELS[step];
  return '已就绪';
}

function progressFor(step: number): number {
  const pct = (step / MAX_STEPS_FOR_FULL_BAR) * 100;
  return Math.min(100, Math.max(0, pct));
}

export function DemoOverlay() {
  const demoRunning = useUiStore((s) => s.demoRunning);
  const demoStep = useUiStore((s) => s.demoStep);
  const stopDemo = useUiStore((s) => s.stopDemo);

  if (!demoRunning) return null;

  const label = stepLabelFor(demoStep);
  const pct = progressFor(demoStep);

  return (
    <div className="dtm-demo-overlay" data-testid="demo-overlay" role="status" aria-live="polite">
      <div className="dtm-demo-progress" aria-hidden="true">
        <div
          className="dtm-demo-progress-bar"
          data-testid="demo-progress-bar"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="dtm-demo-text" data-testid="demo-step-text">
        {label}
      </span>
      <button
        type="button"
        className="dtm-demo-skip"
        onClick={() => stopDemo()}
        data-testid="demo-skip-btn"
      >
        跳过
      </button>
    </div>
  );
}
