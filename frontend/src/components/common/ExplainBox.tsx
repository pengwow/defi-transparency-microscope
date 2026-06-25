/**
 * ExplainBox — collapsible "did you know?" callout used to teach
 * users about a feature or chart.  Stays collapsed by default.
 */

import { useState, type ReactNode } from 'react';

export interface ExplainBoxProps {
  title?: ReactNode;
  children: ReactNode;
  /** Start expanded (default false). */
  defaultOpen?: boolean;
  /** A11y label for the toggle. */
  label?: string;
}

export function ExplainBox({
  title = 'What does this show?',
  children,
  defaultOpen = false,
  label = 'Toggle explanation',
}: ExplainBoxProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <aside className="dtm-explain-box" data-open={open} data-testid="explain-box">
      <button
        type="button"
        className="dtm-explain-toggle"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="dtm-explain-icon" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        <span className="dtm-explain-title">{title}</span>
      </button>
      {open && <div className="dtm-explain-body">{children}</div>}
    </aside>
  );
}
