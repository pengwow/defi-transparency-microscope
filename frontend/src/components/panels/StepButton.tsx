/**
 * StepButton — N-step pill toggle.
 *
 * Used on the Fork tab to walk through the CAPTURE / FORK / PARSE
 * stages.  Each step is a separate pill button; the active one is
 * highlighted.
 *
 *   <StepButton
 *     steps={['CAPTURE', 'FORK', 'PARSE']}
 *     active={1}
 *     onChange={setStep}
 *   />
 */

export interface StepButtonProps {
  steps: string[];
  active: number;
  onChange: (i: number) => void;
  testId?: string;
}

export function StepButton({ steps, active, onChange, testId }: StepButtonProps) {
  return (
    <div className="dtm-step-button" role="group" data-testid={testId}>
      {steps.map((label, i) => {
        const isActive = i === active;
        return (
          <button
            key={label}
            type="button"
            className={`dtm-step-button-pill${isActive ? ' is-active' : ''}`}
            onClick={() => onChange(i)}
            aria-pressed={isActive}
            data-active={isActive ? 'true' : 'false'}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
