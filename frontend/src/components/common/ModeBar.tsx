/**
 * ModeBar — toggle between 'live' and 'replay' modes.
 *
 * Implemented as a radiogroup of two buttons.  The active option
 * carries `aria-selected="true"`; the container advertises
 * `role="radiogroup"`.
 */

import type { Mode } from '@/store/uiStore';

export interface ModeBarProps {
  value: Mode;
  onChange: (mode: Mode) => void;
  /** Disable both options (e.g. while loading). */
  disabled?: boolean;
}

const OPTIONS: Array<{ value: Mode; label: string }> = [
  { value: 'live', label: 'Live' },
  { value: 'replay', label: 'Replay' },
];

export function ModeBar({ value, onChange, disabled }: ModeBarProps) {
  return (
    <div
      className="dtm-mode-bar"
      role="radiogroup"
      aria-label="Mode"
      data-testid="mode-bar"
    >
      {OPTIONS.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-selected={selected}
            disabled={disabled}
            className={`dtm-mode-option${selected ? ' is-active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
