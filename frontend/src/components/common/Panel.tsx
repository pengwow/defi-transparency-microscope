/**
 * Panel — title-bar container used to wrap chart/visualization modules.
 *
 *   <Panel title="AMM Curve" testId="amm-panel">
 *     <Chart />
 *   </Panel>
 *
 * The body is just a `<div>` so consumers can pass anything inside.
 */

import type { ReactNode } from 'react';

export interface PanelProps {
  title?: ReactNode;
  /** Optional content rendered to the right of the title. */
  actions?: ReactNode;
  children: ReactNode;
  /** Optional id for testing or CSS hooks. */
  testId?: string;
}

export function Panel({ title, actions, children, testId }: PanelProps) {
  return (
    <section className="dtm-panel" data-testid={testId}>
      {(title || actions) && (
        <header className="dtm-panel-header">
          {title && <h3 className="dtm-panel-title">{title}</h3>}
          {actions && <div className="dtm-panel-actions">{actions}</div>}
        </header>
      )}
      <div className="dtm-panel-body">{children}</div>
    </section>
  );
}
