/**
 * LoadingScreen — full-bleed loading state with microscope logo
 * and animated progress bar (per DTM_Demo.html `.loading-screen`).
 *
 * The screen mounts, displays a pulsing 🔬 logo, and after
 * `minDurationMs` (default 2.5s) flips into a hidden state and
 * invokes `onReady`.  The parent decides what to render next.
 */

import { useEffect, useState } from 'react';

export interface LoadingScreenProps {
  /** Called once `minDurationMs` has elapsed and the screen is hidden. */
  onReady?: () => void;
  /** How long the splash stays visible.  Defaults to 2500ms. */
  minDurationMs?: number;
  /** Override the default subtitle line. */
  subtitle?: string;
}

const DEFAULT_SUBTITLE = '正在初始化链上机理仿真实验室…';

export function LoadingScreen({
  onReady,
  minDurationMs = 2500,
  subtitle = DEFAULT_SUBTITLE,
}: LoadingScreenProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setHidden(true);
      onReady?.();
    }, minDurationMs);
    return () => clearTimeout(id);
  }, [minDurationMs, onReady]);

  return (
    <div
      className={`dtm-loading-screen${hidden ? ' is-hidden' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy={!hidden}
      data-testid="loading-screen"
    >
      <div
        className="dtm-loading-logo"
        aria-label="DeFi 透明显微镜 loading logo"
        data-testid="loading-logo"
      >
        🔬
      </div>
      <h1 className="dtm-loading-title">DeFi 透明显微镜</h1>
      <p className="dtm-loading-subtitle">{subtitle}</p>
      <div className="dtm-loading-bar" data-testid="loading-bar">
        <div className="dtm-loading-bar-fill" />
      </div>
    </div>
  );
}
