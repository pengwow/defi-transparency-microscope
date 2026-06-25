/**
 * Timeline — a clickable, vertical "learning path" for the Education page.
 *
 * Each step shows an index, a title, and a one-line summary.  The
 * currently-active step is highlighted via `data-active`.
 */

import './Timeline.css';

export interface TimelineStep {
  id: string;
  title: string;
  summary: string;
}

export interface TimelineProps {
  steps: ReadonlyArray<TimelineStep>;
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function Timeline({ steps, activeId, onSelect }: TimelineProps) {
  if (steps.length === 0) {
    return <p className="dtm-timeline-empty">No learning steps.</p>;
  }
  return (
    <ol className="dtm-timeline" data-testid="timeline-list">
      {steps.map((s) => {
        const active = s.id === activeId;
        return (
          <li
            key={s.id}
            className="dtm-timeline-step"
            data-testid="timeline-step"
            data-active={active ? 'true' : 'false'}
          >
            <button
              type="button"
              className="dtm-timeline-button"
              aria-pressed={active}
              onClick={() => onSelect(s.id)}
            >
              <span className="dtm-timeline-index mono">{s.id}</span>
              <span className="dtm-timeline-body">
                <span className="dtm-timeline-title">{s.title}</span>
                <span className="dtm-timeline-summary">{s.summary}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export default Timeline;
