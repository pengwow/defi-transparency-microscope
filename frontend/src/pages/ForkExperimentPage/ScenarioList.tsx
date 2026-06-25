/**
 * ScenarioList — clickable list of experiment presets.
 *
 * Each row shows the scenario's name and a one-line description; the
 * currently-opened scenario carries a `data-active` flag for styling.
 */

import type { ExperimentPreset } from '@/services/api';
import './ScenarioList.css';

export interface ScenarioListProps {
  scenarios: ReadonlyArray<ExperimentPreset>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ScenarioList({ scenarios, selectedId, onSelect }: ScenarioListProps) {
  if (scenarios.length === 0) {
    return <p className="dtm-scenario-list-empty">No scenarios available.</p>;
  }
  return (
    <ul className="dtm-scenario-list" data-testid="scenario-list-items">
      {scenarios.map((s) => {
        const active = s.id === selectedId;
        return (
          <li key={s.id} className="dtm-scenario-list-item">
            <button
              type="button"
              className="dtm-scenario-list-row"
              data-active={active ? 'true' : 'false'}
              onClick={() => onSelect(s.id)}
              aria-pressed={active}
            >
              <span className="dtm-scenario-list-name">{s.name}</span>
              <span className="dtm-scenario-list-desc">{s.description}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default ScenarioList;
