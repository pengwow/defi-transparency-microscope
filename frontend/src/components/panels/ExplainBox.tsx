/**
 * ExplainBox — cyan-bordered "info" callout used across pages to
 * introduce a concept.  Ported from DTM_Demo.html `.explain-box`.
 *
 * Three variants:
 *   - default → cyan top border + grey body
 *   - warning → amber top border
 *   - danger  → coral top border
 */

import type { ReactNode } from 'react';

export type ExplainBoxVariant = 'default' | 'warning' | 'danger';

export interface ExplainBoxProps {
  children: ReactNode;
  /** Color variant. */
  variant?: ExplainBoxVariant;
  /** Optional title row (used as an inner `<strong>`). */
  title?: ReactNode;
  /** Optional test id. */
  testId?: string;
}

export function ExplainBox({
  children,
  variant = 'default',
  title,
  testId,
}: ExplainBoxProps) {
  const cls = ['dtm-explain-box', variant === 'warning' ? 'is-warning' : '', variant === 'danger' ? 'is-danger' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <aside className={cls} data-variant={variant} data-testid={testId}>
      {title && <strong className="dtm-explain-box-title">{title}</strong>}
      <span className="dtm-explain-box-body">{children}</span>
    </aside>
  );
}
