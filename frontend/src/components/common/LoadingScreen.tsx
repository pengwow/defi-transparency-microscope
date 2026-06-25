/**
 * LoadingScreen — full-bleed loading state with a progress bar.
 *
 * `progress` is a number in [0, 1].  When `progress < 1`, the bar
 * animates; once it hits 1, the screen stays in place for a beat
 * (the parent can swap the screen out itself).
 */

export interface LoadingScreenProps {
  /** 0..1 */
  progress?: number;
  /** Optional message. */
  message?: string;
}

export function LoadingScreen({ progress = 0, message = 'Loading…' }: LoadingScreenProps) {
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <div
      className="dtm-loading-screen"
      role="status"
      aria-live="polite"
      aria-busy={pct < 1}
      data-testid="loading-screen"
    >
      <div className="dtm-loading-card">
        <h1 className="dtm-loading-title">DTM</h1>
        <p className="dtm-loading-message">{message}</p>
        <div
          className="dtm-loading-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct * 100)}
        >
          <div className="dtm-loading-bar-fill" style={{ width: `${pct * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
