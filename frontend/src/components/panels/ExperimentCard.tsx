/**
 * ExperimentCard — clickable scenario card with icon, title, and
 * description.  Used on the Fork tab to pick a scenario.
 *
 *   <ExperimentCard
 *     icon="🔬"
 *     title="Sandwich"
 *     description="Front-run + back-run"
 *     active={isActive}
 *     onClick={() => open('sandwich')}
 *   />
 */

export interface ExperimentCardProps {
  icon: string;
  title: string;
  description: string;
  /** Highlights the card with a cyan border. */
  active?: boolean;
  /** Click handler. */
  onClick?: () => void;
  testId?: string;
}

export function ExperimentCard({
  icon,
  title,
  description,
  active = false,
  onClick,
  testId,
}: ExperimentCardProps) {
  const cls = `dtm-experiment-card${active ? ' is-active' : ''}`;
  return (
    <div
      className={cls}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      data-testid={testId}
      data-active={active ? 'true' : 'false'}
    >
      <span className="dtm-experiment-card-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="dtm-experiment-card-body">
        <div className="dtm-experiment-card-title">{title}</div>
        <div className="dtm-experiment-card-desc">{description}</div>
      </div>
    </div>
  );
}
