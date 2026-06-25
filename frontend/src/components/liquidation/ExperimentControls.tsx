/**
 * ExperimentControls — the 3 simulation buttons (开始仿真 / 暂停 /
 * 重置) plus a step counter.
 *
 * The component is fully controlled: the parent owns the `step` and
 * the three handlers.  It does not run its own animation, but the
 * page-level parent typically does.
 */

export interface ExperimentControlsProps {
  /** Current step number, displayed beside the buttons. */
  step?: number;
  onStart?: () => void;
  onPause?: () => void;
  onReset?: () => void;
  testId?: string;
}

export function ExperimentControls({
  step = 0,
  onStart,
  onPause,
  onReset,
  testId = 'liquidation-experiment-controls-panel',
}: ExperimentControlsProps) {
  return (
    <div className="dtm-experiment-controls" data-testid={testId}>
      <div className="dtm-experiment-controls-row">
        <button
          type="button"
          className="dtm-experiment-btn dtm-experiment-btn-start"
          data-testid="liquidation-experiment-start"
          onClick={onStart}
        >
          ▶ 开始仿真
        </button>
        <button
          type="button"
          className="dtm-experiment-btn dtm-experiment-btn-pause"
          data-testid="liquidation-experiment-pause"
          onClick={onPause}
        >
          ⏸ 暂停
        </button>
        <button
          type="button"
          className="dtm-experiment-btn dtm-experiment-btn-reset"
          data-testid="liquidation-experiment-reset"
          onClick={onReset}
        >
          ↺ 重置
        </button>
      </div>
      <div className="dtm-experiment-step" data-testid="liquidation-experiment-step">
        步数：{step}
      </div>
    </div>
  );
}

export default ExperimentControls;
