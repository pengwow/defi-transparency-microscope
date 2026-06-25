/**
 * FlashAlert — demo-style flash notification anchored to the top-right
 * corner.  Reads the single `flashAlert` payload from `useUiStore` and
 * renders it with a coral border, a 🚨 emoji, title, body, and two
 * actions: "🔬 放入显微镜" and "忽略".
 *
 * Auto-dismisses after 8 seconds; hovering pauses the timer.
 */

import { useEffect, useRef, useState } from 'react';
import { useUiStore } from '@/store/uiStore';

const AUTO_DISMISS_MS = 8_000;

export interface FlashAlertProps {
  /** Called when the user clicks "放入显微镜". */
  onEnterMicroscope: () => void;
}

export function FlashAlert({ onEnterMicroscope }: FlashAlertProps) {
  const alert = useUiStore((s) => s.flashAlert);
  const dismiss = useUiStore((s) => s.dismissFlashAlert);
  const [hovered, setHovered] = useState(false);
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;

  useEffect(() => {
    if (!alert) return;
    if (hovered) return;
    const t = setTimeout(() => dismissRef.current(), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [alert, hovered]);

  if (!alert) return null;

  return (
    <div
      className={`dtm-flash-alert dtm-flash-${alert.type}`}
      role="alert"
      aria-live="assertive"
      data-testid="flash-alert"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="dtm-flash-icon" aria-hidden="true">🚨</div>
      <div className="dtm-flash-body">
        <div className="dtm-flash-title">{alert.title}</div>
        <div className="dtm-flash-text">{alert.body}</div>
      </div>
      <div className="dtm-flash-actions">
        <button
          type="button"
          className="dtm-flash-btn dtm-flash-btn-primary"
          onClick={() => {
            onEnterMicroscope();
          }}
        >
          🔬 放入显微镜
        </button>
        <button
          type="button"
          className="dtm-flash-btn dtm-flash-btn-secondary"
          onClick={() => dismiss()}
        >
          忽略
        </button>
      </div>
    </div>
  );
}
