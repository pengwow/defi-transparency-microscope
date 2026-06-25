/**
 * StepControls — 3-step pill toggle for the Fork tab.
 *
 * Renders the "1. 捕获 / 2. 切片 / 3. 解析" pills and a description
 * line for the active step.  The parent owns the active index; the
 * component is fully controlled.
 */

import { StepButton } from '@/components/panels';

export interface StepControlsProps {
  /** Zero-based index of the active step. */
  active: number;
  /** Called with the index of the newly-clicked step. */
  onChange: (i: number) => void;
  /** Description text for the active step. */
  description: string;
  /** Optional test id for the root element. */
  testId?: string;
}

const STEP_LABELS = ['1. 捕获', '2. 切片', '3. 解析'];

export function StepControls({ active, onChange, description, testId }: StepControlsProps) {
  return (
    <div className="dtm-step-controls" data-testid={testId}>
      <StepButton steps={STEP_LABELS} active={active} onChange={onChange} />
      <p className="dtm-step-description">{description}</p>
    </div>
  );
}
