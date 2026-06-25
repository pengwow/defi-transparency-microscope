/**
 * FlashAlert — toast-like alert that displays the most recent UI alert
 * from the store.  The list itself is managed by `useUiStore`; this
 * component is purely a presentational view of the latest entry.
 *
 * Use `<FlashAlert />` once near the root of the app, and push alerts
 * via `useUiStore.getState().pushAlert({...})`.
 */

import { useEffect, useState } from 'react';
import { useUiStore } from '@/store/uiStore';

const AUTO_DISMISS_MS = 4000;

export function FlashAlert() {
  const alerts = useUiStore((s) => s.alerts);
  const clearAlerts = useUiStore((s) => s.clearAlerts);
  const [visible, setVisible] = useState(false);

  // Show the most recent alert, auto-dismiss after a short delay.
  const latest = alerts[alerts.length - 1];

  useEffect(() => {
    if (!latest) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      // Remove only the last one so the list doesn't grow unbounded.
      const next = alerts.slice(0, -1);
      if (next.length === 0) clearAlerts();
      else useUiStore.setState({ alerts: next });
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [latest, alerts, clearAlerts]);

  if (!latest || !visible) return null;

  return (
    <div
      className={`dtm-flash-alert dtm-flash-${latest.level}`}
      role="status"
      aria-live="polite"
      data-testid="flash-alert"
    >
      <span className="dtm-flash-message">{latest.message}</span>
      <button
        type="button"
        className="dtm-flash-dismiss"
        aria-label="Dismiss"
        onClick={() => setVisible(false)}
      >
        ×
      </button>
    </div>
  );
}
