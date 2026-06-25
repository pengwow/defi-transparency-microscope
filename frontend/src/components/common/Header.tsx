/**
 * Header — top app bar with logo and (optional) right-side actions.
 *
 * The Header is intentionally dumb: it accepts `right` as a render
 * slot so the live clock, mode bar, etc. can be composed by the page
 * that owns them.
 */

import type { ReactNode } from 'react';

export interface HeaderProps {
  /** Optional content rendered on the right side (clock, mode bar). */
  right?: ReactNode;
}

export function Header({ right }: HeaderProps) {
  return (
    <header className="dtm-header" data-testid="app-header">
      <div className="dtm-header-left">
        <span className="dtm-header-logo" aria-label="DTM">
          <span className="dtm-header-logo-mark">◎</span>
          <span className="dtm-header-logo-text">DTM</span>
        </span>
        <span className="dtm-header-subtitle muted">DeFi Transparency Microscope</span>
      </div>
      {right && <div className="dtm-header-right">{right}</div>}
    </header>
  );
}
