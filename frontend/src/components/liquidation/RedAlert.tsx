/**
 * RedAlert — top alert banner that appears when the
 * `liquidationStore.redAlert.active` flag is true.
 *
 * Visual: coral border, pulse animation, a small icon, a title, a
 * description, and a close button that calls
 * `dismissRedAlert()`.
 */

import { useLiquidationStore } from '@/store/liquidationStore';

export interface RedAlertProps {
  testId?: string;
}

export function RedAlert({ testId = 'liquidation-red-alert-panel' }: RedAlertProps) {
  const redAlert = useLiquidationStore((s) => s.redAlert);
  const dismissRedAlert = useLiquidationStore((s) => s.dismissRedAlert);

  if (!redAlert || !redAlert.active) return null;

  return (
    <div
      className="dtm-red-alert"
      data-testid={testId}
      role="alert"
      aria-live="assertive"
    >
      <span className="dtm-red-alert-icon" aria-hidden="true">
        🚨
      </span>
      <div className="dtm-red-alert-body">
        <div className="dtm-red-alert-title">{redAlert.title}</div>
        <div className="dtm-red-alert-desc">{redAlert.desc}</div>
      </div>
      <button
        type="button"
        className="dtm-red-alert-close"
        data-testid="liquidation-red-alert-close"
        onClick={dismissRedAlert}
        aria-label="关闭"
      >
        ×
      </button>
    </div>
  );
}

export default RedAlert;
