/**
 * Header — top app bar with microscope logo and (optional) right-side actions.
 *
 * The Header is intentionally dumb: it accepts `right` as a render
 * slot so the live clock, mode bar, etc. can be composed by the page
 * that owns them.  An optional `onStartDemo` button (the coral
 * "一键实验" pill from DTM_Demo.html) can be wired to start a guided
 * experiment when `demoRunning` flips true the pill turns lime.
 */

import type { ReactNode } from 'react';

export interface HeaderProps {
  /** Optional content rendered on the right side (clock, mode bar). */
  right?: ReactNode;
  /** Click handler for the "一键实验" demo button. */
  onStartDemo?: () => void;
  /** When true, the demo button shows the "playing" lime state. */
  demoRunning?: boolean;
}

export function Header({ right, onStartDemo, demoRunning }: HeaderProps) {
  const showDemoBtn = typeof onStartDemo === 'function';
  return (
    <header className="dtm-header" data-testid="app-header">
      <div className="dtm-header-left">
        <span
          className="dtm-header-logo"
          aria-label="DeFi 透明显微镜 logo"
          data-testid="app-header-logo"
        >
          <span className="dtm-header-logo-mark">🔬</span>
          <span className="dtm-header-logo-text">
            <span className="dtm-header-logo-text-dim">DeFi</span>
            <span className="dtm-header-logo-text-bright">透明显微镜</span>
          </span>
        </span>
      </div>
      {(showDemoBtn || right) && (
        <div className="dtm-header-right">
          {showDemoBtn && (
            <button
              type="button"
              className={`dtm-header-demo-btn${demoRunning ? ' is-playing' : ''}`}
              onClick={onStartDemo}
              data-testid="app-header-demo-btn"
              aria-pressed={demoRunning ? true : undefined}
            >
              {demoRunning ? '✓ 实验进行中' : '▶ 一键实验'}
            </button>
          )}
          {right}
        </div>
      )}
    </header>
  );
}
