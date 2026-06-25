/**
 * ModeBar — toggle between 'live' and 'replay' modes.
 *
 * Implemented as a radiogroup of two big-pill buttons (per
 * DTM_Demo.html `.mode-btn`).  The `Mode` type is preserved for
 * backward compatibility with the rest of the app; the visible
 * labels translate `replay` → "Fork 实验切片".
 */

import type { Mode } from '@/store/uiStore';

export interface ModeBarProps {
  value: Mode;
  onChange: (mode: Mode) => void;
  /** Disable both options (e.g. while loading). */
  disabled?: boolean;
}

interface Option {
  value: Mode;
  label: string;
  icon: string;
}

const OPTIONS: ReadonlyArray<Option> = [
  { value: 'live', label: 'Live 实时采样', icon: '📡' },
  { value: 'replay', label: 'Fork 实验切片', icon: '🔬' },
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
            data-testid={`mode-option-${opt.value}`}
          >
            <span className="dtm-mode-indicator" aria-hidden="true" />
            <span className="dtm-mode-icon" aria-hidden="true">
              {opt.icon}
            </span>
            <span className="dtm-mode-label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
