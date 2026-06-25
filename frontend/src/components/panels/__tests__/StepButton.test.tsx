/**
 * Tests for StepButton — N-step pill toggle.
 *
 *   <StepButton steps={['CAPTURE', 'FORK', 'PARSE']} active={1}
 *                onChange={setStep} />
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepButton } from '../StepButton';

describe('StepButton', () => {
  it('renders all steps with the active one highlighted', () => {
    render(
      <StepButton
        steps={['CAPTURE', 'FORK', 'PARSE']}
        active={1}
        onChange={() => undefined}
        testId="steps"
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[1].className).toContain('is-active');
  });

  it('invokes onChange with the clicked step index', () => {
    const cb = vi.fn();
    render(
      <StepButton
        steps={['A', 'B', 'C']}
        active={0}
        onChange={cb}
        testId="steps-cb"
      />,
    );
    fireEvent.click(screen.getAllByRole('button')[2]);
    expect(cb).toHaveBeenCalledWith(2);
  });
});
