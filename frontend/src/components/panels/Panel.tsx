/**
 * Panel — cross-page container primitive.
 *
 * Demo-style: cyan left dot + title + optional right slot; click the
 * header to collapse/expand.  Visual styling lives in demo.css
 * (`.dtm-panel`, `.dtm-panel-header`, `.dtm-panel-dot`, …).
 *
 *   <Panel
 *     title="AMM Curve"
 *     right={<span className="dtm-live-badge">LIVE</span>}
 *     testId="amm-panel"
 *   >
 *     <Chart />
 *   </Panel>
 */

import { useState, type ReactNode } from 'react';

export interface PanelProps {
  /** Title text or element shown in the header. */
  title: ReactNode;
  /** Children — the body content. */
  children: ReactNode;
  /** Color of the leading dot (CSS color, default cyan). */
  dotColor?: string;
  /** Right slot — e.g. a LIVE badge or status pill. */
  right?: ReactNode;
  /** When true, starts collapsed. */
  defaultCollapsed?: boolean;
  /** Optional test hook. */
  testId?: string;
}

export function Panel({
  title,
  children,
  dotColor = 'var(--dtm-cyan)',
  right,
  defaultCollapsed = false,
  testId,
}: PanelProps) {
  const [collapsed, setCollapsed] = useState(Boolean(defaultCollapsed));
  const cls = `dtm-panel${collapsed ? ' is-collapsed' : ''}`;
  return (
    <div className={cls} data-testid={testId}>
      <div
        className="dtm-panel-header"
        onClick={() => setCollapsed((c) => !c)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setCollapsed((c) => !c);
          }
        }}
      >
        <span
          className="dtm-panel-dot"
          style={{ background: dotColor, boxShadow: `0 0 5px ${dotColor}` }}
          aria-hidden="true"
        />
        <span className="dtm-panel-title">{title}</span>
        {right && <span className="dtm-panel-right">{right}</span>}
      </div>
      <div className="dtm-panel-body">{children}</div>
    </div>
  );
}
